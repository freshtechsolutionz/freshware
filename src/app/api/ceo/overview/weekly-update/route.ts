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

function fmtMoney(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n));
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

    const [oppRes, projRes, tasksRes, meetingsRes] = await Promise.all([
      svc.from("opportunities").select("id, name, stage, amount").eq("account_id", accountId),
      svc.from("projects").select("id, status").eq("account_id", accountId),
      svc.from("tasks").select("task_id, title, status, due_at").eq("account_id", accountId),
      svc.from("meetings").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    ]);

    const oppRows = oppRes.error ? [] : ((oppRes.data || []) as any[]);
    const openOpp = oppRows.filter((r) => {
      const s = String(r.stage || "").toLowerCase();
      return s !== "won" && s !== "lost";
    });

    const openOppCount = openOpp.length;
    const openPipeline = openOpp.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const pipelineByStageMap: Record<string, { count: number; amount: number }> = {};
    for (const r of openOpp) {
      const stage = String(r.stage || "Unstaged");
      if (!pipelineByStageMap[stage]) pipelineByStageMap[stage] = { count: 0, amount: 0 };
      pipelineByStageMap[stage].count += 1;
      pipelineByStageMap[stage].amount += Number(r.amount) || 0;
    }

    const topStages = Object.entries(pipelineByStageMap)
      .map(([stage, v]) => ({ stage, count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const topDeals = openOpp
      .slice()
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 3)
      .map((r) => ({
        id: r.id,
        name: r.name || null,
        stage: r.stage || null,
        amount: Number(r.amount) || 0,
      }));

    const projRows = projRes.error ? [] : ((projRes.data || []) as any[]);
    const totalProjects = projRows.length;
    const activeProjects = projRows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return !["done", "closed", "completed", "cancelled"].includes(s);
    }).length;

    const taskRows = tasksRes.error ? [] : ((tasksRes.data || []) as any[]);
    const totalTasks = taskRows.length;
    const overdueTasks = taskRows.filter((t) => {
      const st = String(t.status || "").toLowerCase();
      const done = st === "done";
      const due = t.due_at ? new Date(String(t.due_at)) : null;
      return !!due && !done && due.getTime() < now.getTime();
    }).length;

    const blockedTasks = taskRows.filter((t) => String(t.status || "").toLowerCase() === "blocked").length;

    const meetingsBooked = meetingsRes.count ?? 0;

    const lines: string[] = [];
    lines.push("Freshware CEO Weekly Update");
    lines.push("");
    lines.push("Scoreboard");
    lines.push(`Open pipeline: ${fmtMoney(openPipeline)} across ${openOppCount} deals`);
    lines.push(`Active projects: ${activeProjects} (total ${totalProjects})`);
    lines.push(`Tasks: ${totalTasks} total, ${overdueTasks} overdue, ${blockedTasks} blocked`);
    lines.push(`Meetings booked: ${meetingsBooked}`);
    lines.push("");

    lines.push("Pipeline focus (top stages by value)");
    if (!topStages.length) lines.push("No staged open pipeline data yet.");
    for (const s of topStages) {
      lines.push(`- ${s.stage}: ${fmtMoney(s.amount)} (${s.count} deals)`);
    }
    lines.push("");

    lines.push("Top deals to push");
    if (!topDeals.length) lines.push("No open deals found.");
    for (const d of topDeals) {
      lines.push(`- ${String(d.name || d.id).slice(0, 48)}: ${fmtMoney(d.amount)} (stage: ${d.stage || "Unstaged"})`);
    }
    lines.push("");

    lines.push("CEO priorities for the week");
    lines.push("1) Move the top 3 deals to a clear next step (decision date and owner).");
    lines.push("2) Clear blocked tasks first, then overdue tasks.");
    lines.push("3) Confirm next milestones for every active project and communicate them.");
    lines.push("");
    lines.push("If you want, say: Generate an executive email version of this update.");

    return NextResponse.json({ text: lines.join("\n") });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
