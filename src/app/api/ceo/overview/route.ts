import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  role: string | null;
  account_id: string | null;
};

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function svcSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getViewer() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, reason: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return { ok: false as const, reason: "Missing profile row" };
  return { ok: true as const, userId: auth.user.id, profile: profile as ProfileRow };
}

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfMonthUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

export async function GET() {
  try {
    const viewer = await getViewer();
    if (!viewer.ok) return NextResponse.json({ error: viewer.reason }, { status: 401 });

    const { profile } = viewer;
    if (!profile.account_id) return NextResponse.json({ error: "Missing profiles.account_id" }, { status: 400 });
    if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const svc = svcSupabase();
    if (!svc) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

    const accountId = profile.account_id;
    const now = new Date();
    const nowIso = now.toISOString();

    // Fast counts
    const [usersRes, tasksRes, meetingsRes, projectsRes, oppRes] = await Promise.all([
      svc.from("profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      svc.from("tasks").select("task_id", { count: "exact", head: true }).eq("account_id", accountId),
      svc.from("meetings").select("id", { count: "exact", head: true }).eq("account_id", accountId),
      svc.from("projects").select("id,status", { count: "exact" }).eq("account_id", accountId),
      svc.from("opportunities").select("id, stage, amount").eq("account_id", accountId),
    ]);

    const totalUsers = usersRes.count ?? 0;
    const totalTasks = tasksRes.count ?? 0;
    const meetingsBooked = meetingsRes.count ?? 0;

    // Projects active
    let activeProjects = 0;
    let totalProjects = 0;
    if (!projectsRes.error) {
      const rows = (projectsRes.data || []) as any[];
      totalProjects = projectsRes.count ?? rows.length;
      activeProjects = rows.filter((r) => {
        const s = String(r.status || "").toLowerCase();
        return !["done", "closed", "completed", "cancelled"].includes(s);
      }).length;
    }

    // Pipeline + stage grouping
    const oppRows = oppRes.error ? [] : ((oppRes.data || []) as any[]);
    const openOppRows = oppRows.filter((r) => {
      const s = String(r.stage || "").toLowerCase();
      return s !== "won" && s !== "lost";
    });

    const openOppCount = openOppRows.length;
    const openPipeline = openOppRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const pipelineByStageMap: Record<string, { count: number; amount: number }> = {};
    for (const r of openOppRows) {
      const stage = String(r.stage || "Unstaged");
      if (!pipelineByStageMap[stage]) pipelineByStageMap[stage] = { count: 0, amount: 0 };
      pipelineByStageMap[stage].count += 1;
      pipelineByStageMap[stage].amount += Number(r.amount) || 0;
    }

    const pipelineByStage = Object.entries(pipelineByStageMap)
      .map(([stage, v]) => ({ stage, count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);

    const topDeals = openOppRows
      .slice()
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        stage: r.stage || null,
        amount: Number(r.amount) || 0,
      }));

    // Overdue tasks + blockers + status counts
    const tasksDetailRes = await svc
      .from("tasks")
      .select("task_id, status, due_at")
      .eq("account_id", accountId);

    let overdueTasks = 0;
    let blockedTasks = 0;
    const tasksByStatus: Record<string, number> = {};

    if (!tasksDetailRes.error) {
      const rows = (tasksDetailRes.data || []) as any[];
      for (const t of rows) {
        const st = String(t.status || "New");
        tasksByStatus[st] = (tasksByStatus[st] || 0) + 1;

        const due = t.due_at ? new Date(String(t.due_at)) : null;
        const done = st.toLowerCase() === "done";
        if (due && !done && due.getTime() < now.getTime()) overdueTasks += 1;
        if (st.toLowerCase() === "blocked") blockedTasks += 1;
      }
    }

    // Revenue trend (last 6 months)
    const months: string[] = [];
    const start = startOfMonthUTC(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)));
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      months.push(monthKey(d));
    }

    const revRes = await svc
      .from("revenue_entries")
      .select("amount, created_at")
      .eq("account_id", accountId)
      .gte("created_at", start.toISOString());

    const revenueByMonth: Record<string, number> = {};
    for (const m of months) revenueByMonth[m] = 0;

    if (!revRes.error) {
      const rows = (revRes.data || []) as any[];
      for (const r of rows) {
        const created = r.created_at ? new Date(String(r.created_at)) : null;
        if (!created) continue;
        const key = monthKey(created);
        if (key in revenueByMonth) revenueByMonth[key] += Number(r.amount) || 0;
      }
    }

    const revenueTrend = months.map((m) => ({ month: m, amount: revenueByMonth[m] || 0 }));

    return NextResponse.json({
      accountId,
      generatedAt: nowIso,
      kpis: {
        totalUsers,
        totalTasks,
        overdueTasks,
        blockedTasks,
        meetingsBooked,
        activeProjects,
        totalProjects,
        openOppCount,
        openPipeline,
      },
      pipelineByStage,
      topDeals,
      tasksByStatus,
      revenueTrend,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
