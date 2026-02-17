import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function addMonths(d: Date, delta: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 0, 0, 0));
}

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabelFromKey(key: string) {
  // key: YYYY-MM
  const [y, m] = key.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return dt.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  // KPIs
  const nowIso = new Date().toISOString();

  const [
    tasksRes,
    blockedRes,
    meetingsRes,
    projectsRes,
    oppRes,
    revenueRes,
  ] = await Promise.all([
    // overdue tasks (not Done, due < now)
    supabase
      .from("tasks")
      .select("task_id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .lt("due_at", nowIso)
      .not("status", "in", '("Done")'),

    // blocked tasks
    supabase
      .from("tasks")
      .select("task_id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "Blocked"),

    // meetings booked
    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId),

    // projects
    supabase
      .from("projects")
      .select("id,status", { count: "exact" })
      .eq("account_id", accountId),

    // opportunities (for open pipeline)
    supabase
      .from("opportunities")
      .select("id, amount, stage", { count: "exact" })
      .eq("account_id", accountId),

    // revenue entries for trend (created_at based)
    supabase
      .from("revenue_entries")
      .select("amount, created_at")
      .eq("account_id", accountId),
  ]);

  if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 });
  if (blockedRes.error) return NextResponse.json({ error: blockedRes.error.message }, { status: 500 });
  if (meetingsRes.error) return NextResponse.json({ error: meetingsRes.error.message }, { status: 500 });
  if (projectsRes.error) return NextResponse.json({ error: projectsRes.error.message }, { status: 500 });
  if (oppRes.error) return NextResponse.json({ error: oppRes.error.message }, { status: 500 });
  if (revenueRes.error) return NextResponse.json({ error: revenueRes.error.message }, { status: 500 });

  const overdueTasks = tasksRes.count ?? 0;
  const blockedTasks = blockedRes.count ?? 0;
  const meetingsBooked = meetingsRes.count ?? 0;

  const projectsRows = (projectsRes.data || []) as Array<{ id: string; status: string | null }>;
  const totalProjects = projectsRes.count ?? projectsRows.length ?? 0;
  const activeProjects = projectsRows.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return !["done", "closed", "completed", "cancelled"].includes(s);
  }).length;

  const oppRows = (oppRes.data || []) as Array<{ id: string; amount: number | null; stage: string | null }>;
  const openOpp = oppRows.filter((o) => {
    const s = String(o.stage || "").toLowerCase();
    return s !== "won" && s !== "lost";
  });
  const openOppCount = openOpp.length;
  const openPipeline = openOpp.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Pipeline by stage (top 6)
  const byStageMap: Record<string, { count: number; amount: number }> = {};
  for (const o of oppRows) {
    const stage = (String(o.stage || "Unknown").trim() || "Unknown");
    const amt = Number(o.amount || 0) || 0;
    if (!byStageMap[stage]) byStageMap[stage] = { count: 0, amount: 0 };
    byStageMap[stage].count += 1;
    byStageMap[stage].amount += amt;
  }
  const pipelineByStage = Object.entries(byStageMap)
    .map(([stage, v]) => ({ stage, count: v.count, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  // Revenue Trend (last 6 months, created_at based)
  const now = new Date();
  const thisMonth = startOfMonth(now);
  const start = addMonths(thisMonth, -5); // includes this month + 5 back
  const buckets: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    const k = monthKey(addMonths(start, i));
    buckets[k] = 0;
  }

  const revRows = (revenueRes.data || []) as Array<{ amount: number | null; created_at: string | null }>;
  for (const r of revRows) {
    if (!r.created_at) continue;
    const dt = new Date(r.created_at);
    if (dt < start) continue;
    const k = monthKey(startOfMonth(dt));
    if (!(k in buckets)) continue;
    buckets[k] += Number(r.amount || 0) || 0;
  }

  const revenueTrend = Object.keys(buckets)
    .sort()
    .map((k) => ({ month: monthLabelFromKey(k), amount: buckets[k] }));

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      kpis: {
        overdueTasks,
        blockedTasks,
        meetingsBooked,
        activeProjects,
        totalProjects,
        openOppCount,
        openPipeline,
      },
      pipelineByStage,
      revenueTrend,
    },
    { status: 200 }
  );
}
