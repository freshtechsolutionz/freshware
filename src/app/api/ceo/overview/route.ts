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
  const [y, m] = key.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return dt.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function parseDate(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const nowIso = new Date().toISOString();

  const [
    tasksRes,
    blockedRes,
    meetingsRes,
    projectsRes,
    oppRes,
    revenueRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("task_id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .lt("due_at", nowIso)
      .not("status", "in", '("Done")'),

    supabase
      .from("tasks")
      .select("task_id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "Blocked"),

    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId),

    supabase
      .from("projects")
      .select("id,status", { count: "exact" })
      .eq("account_id", accountId),

    supabase
      .from("opportunities")
      .select("id, amount, stage")
      .eq("account_id", accountId),

    supabase
      .from("revenue_entries")
      .select("amount, recognized_on, entry_date, frequency, start_date, end_date, status, paid, revenue_type, type, source")
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
    return !["done", "closed", "completed", "cancelled", "canceled"].includes(s);
  }).length;

  const oppRows = (oppRes.data || []) as Array<{ id: string; amount: number | null; stage: string | null }>;
  const openOpp = oppRows.filter((o) => {
    const s = String(o.stage || "").toLowerCase();
    return s !== "won" && s !== "lost";
  });
  const openOppCount = openOpp.length;
  const openPipeline = openOpp.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const byStageMap: Record<string, { count: number; amount: number }> = {};
  for (const o of oppRows) {
    const stage = String(o.stage || "Unknown").trim() || "Unknown";
    const amt = Number(o.amount || 0) || 0;
    if (!byStageMap[stage]) byStageMap[stage] = { count: 0, amount: 0 };
    byStageMap[stage].count += 1;
    byStageMap[stage].amount += amt;
  }

  const pipelineByStage = Object.entries(byStageMap)
    .map(([stage, v]) => ({ stage, count: v.count, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  // Revenue trend
  const now = new Date();
  const thisMonth = startOfMonth(now);
  const start = addMonths(thisMonth, -5);

  const buckets: Record<string, number> = {};
  for (let i = 0; i < 6; i++) {
    buckets[monthKey(addMonths(start, i))] = 0;
  }

  const revenueRows = (revenueRes.data || []) as Array<{
    amount: number | null;
    recognized_on: string | null;
    entry_date: string | null;
    frequency: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
    paid: boolean | null;
    revenue_type: string | null;
    type: string | null;
    source: string | null;
  }>;

  for (const r of revenueRows) {
    const amount = Number(r.amount || 0) || 0;
    if (!amount) continue;

    const effectiveStatus = String(r.status || (r.paid ? "received" : "pending") || "").toLowerCase();
    const frequency = String(r.frequency || "one_time").toLowerCase();

    if (frequency === "monthly") {
      // Recurring support / MRR: add amount to every active month in the visible range
      const startDate =
        parseDate(r.start_date) ||
        parseDate(r.recognized_on) ||
        parseDate(r.entry_date) ||
        start;

      const endDate =
        parseDate(r.end_date) ||
        thisMonth;

      if (!startDate) continue;

      let cursor = startOfMonth(startDate < start ? start : startDate);
      const hardEnd = startOfMonth(endDate > thisMonth ? thisMonth : endDate);

      while (cursor <= hardEnd) {
        const key = monthKey(cursor);
        if (key in buckets && ["active", "recognized", "received", ""].includes(effectiveStatus)) {
          buckets[key] += amount;
        }
        cursor = addMonths(cursor, 1);
      }
    } else {
      // One-time revenue
      const dt =
        parseDate(r.recognized_on) ||
        parseDate(r.entry_date);

      if (!dt) continue;
      if (dt < start) continue;

      const key = monthKey(startOfMonth(dt));
      if (key in buckets) {
        buckets[key] += amount;
      }
    }
  }

  const revenueTrend = Object.keys(buckets)
    .sort()
    .map((k) => ({
      month: monthLabelFromKey(k),
      amount: buckets[k],
    }));

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