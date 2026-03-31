import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AgentRequest = { message: string };

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  account_id: string | null;
};

type TaskInsert = {
  task_id: string;
  account_id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  due_at?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  project_id?: string | null;
  opportunity_id?: string | null;
};

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function nowIso() {
  return new Date().toISOString();
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
    .select("id, full_name, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return { ok: false as const, reason: "Missing profile row" };

  return { ok: true as const, supabase, user: auth.user, profile: profile as ProfileRow };
}

function normalizeBucketName(input: string) {
  const s = (input || "").trim().toLowerCase();
  if (!s) return "Admin";
  if (s.includes("admin") || s.includes("general")) return "Admin";
  if (s.includes("ops")) return "Ops";
  if (s.includes("sales")) return "Sales";
  if (s.includes("market")) return "Marketing";
  return "Admin";
}

function safeStatus(input: any) {
  const s = String(input || "").trim();
  const allowed = new Set(["New", "In Progress", "Done", "Blocked"]);
  return allowed.has(s) ? s : "New";
}

function parseChicagoDueAt(text: string): string | null {
  const raw = (text || "").toLowerCase();
  const hasFriday = raw.includes("friday");
  const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!hasFriday || !timeMatch) return null;

  const hourRaw = Number(timeMatch[1]);
  const minRaw = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const ampm = timeMatch[3];

  if (!hourRaw || hourRaw < 1 || hourRaw > 12) return null;
  if (minRaw < 0 || minRaw > 59) return null;

  let hour24 = hourRaw % 12;
  if (ampm === "pm") hour24 += 12;

  const tz = "America/Chicago";
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const yyyy = Number(get("year"));
  const mm = Number(get("month"));
  const dd = Number(get("day"));
  const weekday = get("weekday");

  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayIdx = weekdayIndex[weekday] ?? null;
  if (todayIdx === null) return null;

  const targetIdx = 5;
  let delta = targetIdx - todayIdx;
  if (delta < 0) delta += 7;
  if (delta === 0) delta = 7;

  const intendedUtc = new Date(Date.UTC(yyyy, mm - 1, dd + delta, hour24, minRaw, 0));

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const wallParts = fmt.formatToParts(intendedUtc);
  const wY = Number(wallParts.find((p) => p.type === "year")?.value || "");
  const wM = Number(wallParts.find((p) => p.type === "month")?.value || "");
  const wD = Number(wallParts.find((p) => p.type === "day")?.value || "");
  const wH = Number(wallParts.find((p) => p.type === "hour")?.value || "");
  const wMin = Number(wallParts.find((p) => p.type === "minute")?.value || "");

  const observedAsUtc = new Date(Date.UTC(wY, wM - 1, wD, wH, wMin, 0));
  const diffMs = intendedUtc.getTime() - observedAsUtc.getTime();
  const corrected = new Date(intendedUtc.getTime() + diffMs);

  return corrected.toISOString();
}

function parseCreateTaskIntent(message: string) {
  const m = message.trim();
  const lower = m.toLowerCase();

  const idx1 = lower.indexOf("create a task");
  const idx2 = lower.indexOf("create task");

  let title = "";
  if (idx1 >= 0) title = m.slice(idx1 + "create a task".length).trim();
  else if (idx2 >= 0) title = m.slice(idx2 + "create task".length).trim();

  title = title.replace(/^[:\-–—]\s*/, "").trim();
  if (!title) return null;

  const bucket =
    lower.includes("under ops") ? "Ops" :
    lower.includes("under sales") ? "Sales" :
    lower.includes("under marketing") ? "Marketing" :
    lower.includes("under general") ? "Admin" :
    lower.includes("under admin") ? "Admin" :
    "Admin";

  const dueAt = parseChicagoDueAt(m);
  return { title, bucket, due_at: dueAt };
}

function classifyDbError(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("row-level security") || m.includes("rls")) return "RLS_BLOCK";
  if (m.includes("foreign key")) return "FK";
  if (m.includes("not-null constraint") || m.includes("null value in column")) return "NOT_NULL";
  if (m.includes("invalid input value for enum") || m.includes("violates check constraint")) return "ENUM_OR_CHECK";
  if (m.includes("invalid input syntax for type uuid")) return "UUID_SYNTAX";
  if (m.includes("permission denied")) return "PERMISSION";
  return "UNKNOWN";
}

async function getOrCreateProjectByName(accountId: string, viewerId: string, name: string) {
  const svc = svcSupabase();
  if (!svc) return { ok: false as const, error: "Missing SUPABASE_SERVICE_ROLE_KEY (server env)" };

  const projectName = (name || "").trim() || "Admin";

  const existing = await svc
    .from("projects")
    .select("id, name, account_id")
    .eq("account_id", accountId)
    .ilike("name", projectName)
    .maybeSingle();

  if (!existing.error && existing.data?.id) {
    return { ok: true as const, project: existing.data as ProjectRow };
  }

  const projectId = crypto.randomUUID();

  const attempt1 = await svc
    .from("projects")
    .insert({
      id: projectId,
      account_id: accountId,
      name: projectName,
      owner_user_id: viewerId,
      created_at: nowIso(),
    })
    .select("id, name, account_id")
    .maybeSingle();

  if (!attempt1.error && attempt1.data?.id) {
    return { ok: true as const, project: attempt1.data as ProjectRow };
  }

  const err1 = attempt1.error?.message || "Failed to create project";
  const kind1 = classifyDbError(err1);

  if (kind1 === "NOT_NULL") {
    const attempt2 = await svc
      .from("projects")
      .insert({
        id: projectId,
        account_id: accountId,
        name: projectName,
        owner_user_id: viewerId,
        created_at: nowIso(),
        status: "Active",
        health: "Good",
      })
      .select("id, name, account_id")
      .maybeSingle();

    if (!attempt2.error && attempt2.data?.id) {
      return { ok: true as const, project: attempt2.data as ProjectRow };
    }

    return { ok: false as const, error: attempt2.error?.message || err1 };
  }

  return { ok: false as const, error: err1 };
}

async function insertTaskWithAutoAttach(params: {
  accountId: string;
  viewerId: string;
  title: string;
  due_at: string | null;
  bucketName: string;
}) {
  const svc = svcSupabase();
  if (!svc) return { ok: false as const, error: "Missing SUPABASE_SERVICE_ROLE_KEY (server env)" };

  const bucket = normalizeBucketName(params.bucketName);
  const projRes = await getOrCreateProjectByName(params.accountId, params.viewerId, bucket);
  if (!projRes.ok) return { ok: false as const, error: projRes.error };

  const task: TaskInsert = {
    task_id: crypto.randomUUID(),
    account_id: params.accountId,
    title: params.title,
    description: null,
    status: safeStatus("New"),
    due_at: params.due_at,
    assigned_to: params.viewerId,
    created_by: params.viewerId,
    project_id: projRes.project.id,
    opportunity_id: null,
  };

  const first = await svc
    .from("tasks")
    .insert(task)
    .select("task_id, title, status, due_at, assigned_to, project_id, opportunity_id")
    .maybeSingle();

  if (!first.error && first.data) return { ok: true as const, created: first.data };

  const err1 = first.error?.message || "Validation error";
  const kind = classifyDbError(err1);

  if (kind === "ENUM_OR_CHECK") task.status = "New";
  if (kind === "NOT_NULL" && !task.due_at) task.due_at = nowIso();

  const second = await svc
    .from("tasks")
    .insert(task)
    .select("task_id, title, status, due_at, assigned_to, project_id, opportunity_id")
    .maybeSingle();

  if (!second.error && second.data) return { ok: true as const, created: second.data };

  const err2 = second.error?.message || err1;
  return { ok: false as const, error: err2 };
}

function isQuestionAboutPipeline(t: string) {
  const s = t.toLowerCase();
  return s.includes("pipeline") || s.includes("opportunit") || s.includes("deals");
}
function isQuestionAboutOverdue(t: string) {
  const s = t.toLowerCase();
  return s.includes("overdue") || s.includes("past due") || s.includes("blocked tasks") || s.includes("blocked");
}
function isQuestionAboutProjects(t: string) {
  const s = t.toLowerCase();
  return s.includes("project health") || s.includes("health") || s.includes("at risk") || s.includes("red");
}
function isQuestionAboutMeetings(t: string) {
  const s = t.toLowerCase();
  return s.includes("meetings") || s.includes("booked") || s.includes("calls") || s.includes("demos");
}
function isFocusQuestion(t: string) {
  const s = t.toLowerCase();
  return s.includes("focus") || s.includes("today") || s.includes("what should i do") || s.includes("priorit");
}
function isQuestionAboutStuckDeals(t: string) {
  const s = t.toLowerCase();
  return s.includes("stuck deals") || s.includes("stalled deals") || s.includes("idle deals");
}
function isQuestionAboutEnterpriseBlockers(t: string) {
  const s = t.toLowerCase();
  return s.includes("enterprise blocker") || s.includes("enterprise deals are blocked") || s.includes("missing decision maker") || s.includes("missing budget") || s.includes("missing timeline");
}
function isQuestionAboutLeadFlow(t: string) {
  const s = t.toLowerCase();
  return s.includes("lead") || s.includes("follow-up") || s.includes("follow up") || s.includes("outreach");
}

function money(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n || 0));
}

async function fetchPipelineSummary(supabase: any, accountId: string, rangeDays: number) {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, rangeDays));
  const sinceIso = since.toISOString();

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, stage, amount, created_at")
    .eq("account_id", accountId)
    .gte("created_at", sinceIso);

  if (error) return { ok: false as const, error: error.message };

  const rows = (data || []) as any[];
  const byStage: Record<string, { count: number; total: number }> = {};
  let openCount = 0;
  let openTotal = 0;

  for (const r of rows) {
    const stage = String(r.stage || "Unknown").trim() || "Unknown";
    const amt = Number(r.amount || 0) || 0;

    if (!byStage[stage]) byStage[stage] = { count: 0, total: 0 };
    byStage[stage].count += 1;
    byStage[stage].total += amt;

    const s = stage.toLowerCase();
    if (s !== "won" && s !== "lost") {
      openCount += 1;
      openTotal += amt;
    }
  }

  const topStages = Object.entries(byStage)
    .map(([stage, v]) => ({ stage, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    ok: true as const,
    rangeDays,
    total: rows.length,
    openCount,
    openTotal,
    topStages,
  };
}

async function fetchOverdueSummary(supabase: any, accountId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .select("task_id, title, status, due_at")
    .eq("account_id", accountId)
    .lt("due_at", now)
    .not("status", "in", '("Done")')
    .order("due_at", { ascending: true });

  if (error) return { ok: false as const, error: error.message };

  const rows = (data || []) as any[];
  const blocked = rows.filter((t) => String(t.status || "").toLowerCase() === "blocked").length;

  return {
    ok: true as const,
    overdue: rows.length,
    blocked,
    sample: rows.slice(0, 5).map((t) => ({
      title: t.title,
      status: t.status,
      due_at: t.due_at,
    })),
  };
}

async function fetchProjectHealthSummary(supabase: any, accountId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, health, status, stage, start_date, due_date, created_at")
    .eq("account_id", accountId);

  if (error) return { ok: false as const, error: error.message };

  const rows = (data || []) as any[];
  const counts = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
  const reds: Array<{ name: string; health: string | null }> = [];

  for (const p of rows) {
    const h = String(p.health || "").toUpperCase();
    if (h.includes("RED")) counts.RED++;
    else if (h.includes("YELLOW")) counts.YELLOW++;
    else if (h.includes("GREEN")) counts.GREEN++;
    else counts.UNKNOWN++;

    if (h.includes("RED")) reds.push({ name: p.name || "Unnamed project", health: p.health });
  }

  return {
    ok: true as const,
    total: rows.length,
    counts,
    topReds: reds.slice(0, 5),
  };
}

async function fetchMeetingsSummary(supabase: any, accountId: string, range: "today" | "week" | "7" | "30") {
  const now = new Date();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  let since = new Date(start);
  if (range === "today") {
    // keep since today
  } else if (range === "week") {
    const day = start.getDay();
    const mondayDelta = day === 0 ? -6 : 1 - day;
    since.setDate(start.getDate() + mondayDelta);
  } else if (range === "7") {
    since.setDate(start.getDate() - 6);
  } else {
    since.setDate(start.getDate() - 29);
  }

  const { data, error } = await supabase
    .from("meetings")
    .select("id, contact_name, contact_email, scheduled_at, status, source")
    .eq("account_id", accountId)
    .gte("scheduled_at", since.toISOString())
    .order("scheduled_at", { ascending: false });

  if (error) return { ok: false as const, error: error.message };

  const rows = (data || []) as any[];
  return {
    ok: true as const,
    range,
    count: rows.length,
    sample: rows.slice(0, 5).map((m) => ({
      who: m.contact_name || m.contact_email || "Unknown",
      scheduled_at: m.scheduled_at,
      status: m.status,
      source: m.source,
    })),
  };
}

async function fetchLeadDigest(supabase: any, accountId: string) {
  const { data, error } = await supabase
    .from("lead_prospects")
    .select("status, outreach_status, next_follow_up_at, total_score")
    .eq("account_id", accountId);

  if (error) return { ok: false as const, error: error.message };

  const rows = (data || []) as any[];
  return {
    ok: true as const,
    total: rows.length,
    newLeads: rows.filter((l) => String(l.status || "").toUpperCase() === "NEW").length,
    responded: rows.filter((l) => String(l.outreach_status || "").toUpperCase() === "RESPONDED").length,
    followUpDue: rows.filter((l) => {
      if (!l.next_follow_up_at) return false;
      const d = new Date(l.next_follow_up_at);
      return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
    }).length,
    highScore: rows.filter((l) => Number(l.total_score || 0) >= 80).length,
  };
}

async function fetchCeoMondaySummary(accountId: string) {
  const svc = svcSupabase();
  if (!svc) return { ok: false as const, error: "Missing SUPABASE_SERVICE_ROLE_KEY (server env)" };

  const { data: oppIds, error: idErr } = await svc
    .from("opportunities")
    .select("id")
    .eq("account_id", accountId);

  if (idErr) return { ok: false as const, error: idErr.message };

  const idSet = new Set((oppIds || []).map((r: any) => r.id));

  const { data, error } = await svc.rpc("ceo_monday_summary");
  if (error) return { ok: false as const, error: error.message };

  const cleanArray = (value: any[]) =>
    Array.isArray(value) ? value.filter((row) => !row?.opportunity_id || idSet.has(row.opportunity_id)) : [];

  const cleanStageBreakdown = Array.isArray(data?.stage_breakdown) ? data.stage_breakdown : [];
  const cleanKpis = data?.kpis || {};

  return {
    ok: true as const,
    summary: {
      generated_at: data?.generated_at || new Date().toISOString(),
      kpis: cleanKpis,
      stage_breakdown: cleanStageBreakdown,
      stuck_deals: cleanArray(data?.stuck_deals || []),
      upcoming_closes: cleanArray(data?.upcoming_closes || []),
      enterprise_blockers: cleanArray(data?.enterprise_blockers || []),
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentRequest;
    const raw = String(body?.message || "").trim();
    if (!raw) return NextResponse.json({ reply: "Type a message and I’ll respond." }, { status: 200 });

    const viewer = await getViewer();
    if (!viewer.ok) {
      return NextResponse.json({ reply: "You must be logged in to use the agent." }, { status: 200 });
    }

    const { user, profile, supabase } = viewer;
    if (!profile.account_id) {
      return NextResponse.json({ reply: "Your profile is missing account_id." }, { status: 200 });
    }

    const staff = isStaff(profile.role);

    const intent = parseCreateTaskIntent(raw);
    if (intent) {
      if (!staff) {
        return NextResponse.json(
          { reply: "You have view access only. Task creation is restricted to staff roles." },
          { status: 200 }
        );
      }

      const result = await insertTaskWithAutoAttach({
        accountId: profile.account_id,
        viewerId: user.id,
        title: intent.title,
        due_at: intent.due_at,
        bucketName: intent.bucket,
      });

      if (!result.ok) {
        return NextResponse.json(
          { reply: "Task not created. " + result.error },
          { status: 200 }
        );
      }

      const bucketLabel = normalizeBucketName(intent.bucket);
      const dueText = result.created?.due_at
        ? ` Due: ${new Date(result.created.due_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT.`
        : "";

      return NextResponse.json(
        { reply: `Done. Created "${result.created.title}" under ${bucketLabel}.${dueText}`, created_tasks: [result.created] },
        { status: 200 }
      );
    }

    const accountId = profile.account_id;

    if (isFocusQuestion(raw)) {
      const [o, p, pr, leads, monday] = await Promise.all([
        fetchOverdueSummary(supabase, accountId),
        fetchPipelineSummary(supabase, accountId, 30),
        fetchProjectHealthSummary(supabase, accountId),
        fetchLeadDigest(supabase, accountId),
        fetchCeoMondaySummary(accountId),
      ]);

      const lines: string[] = [];
      lines.push("Here’s your executive focus for today:");

      if (monday.ok && monday.summary.kpis) {
        lines.push(`- Weighted pipeline: ${money(Number(monday.summary.kpis.weighted_pipeline_all || 0))}`);
      }

      if (o.ok) {
        lines.push(`- Overdue tasks: ${o.overdue} (Blocked: ${o.blocked})`);
      } else {
        lines.push(`- Overdue tasks: error (${o.error})`);
      }

      if (pr.ok) {
        lines.push(`- Project health: RED ${pr.counts.RED}, YELLOW ${pr.counts.YELLOW}, GREEN ${pr.counts.GREEN}, UNKNOWN ${pr.counts.UNKNOWN}`);
      } else {
        lines.push(`- Project health: error (${pr.error})`);
      }

      if (p.ok) {
        lines.push(`- Open pipeline (last ${p.rangeDays} days): ${p.openCount} deals totaling ${money(p.openTotal)}`);
        const top = p.topStages.slice(0, 3).map((s) => `${s.stage} ${money(s.total)}`).join(", ");
        if (top) lines.push(`- Biggest stages: ${top}`);
      } else {
        lines.push(`- Pipeline: error (${p.error})`);
      }

      if (leads.ok) {
        lines.push(`- Leads needing action: ${leads.followUpDue} follow-ups due, ${leads.highScore} high-score leads`);
      }

      if (monday.ok && monday.summary.stuck_deals?.length) {
        const topStuck = monday.summary.stuck_deals
          .slice(0, 3)
          .map((d: any) => `${d.opportunity_name || "Unnamed"} (${d.days_since_activity || 0}d idle)`)
          .join(", ");
        lines.push(`- Stuck deals: ${topStuck}`);
      }

      lines.push("");
      lines.push("If you want, tell me:");
      lines.push(`“Create a task: Clear top 3 overdue items (under Admin) due Friday 2pm CST”`);

      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutStuckDeals(raw)) {
      const monday = await fetchCeoMondaySummary(accountId);
      if (!monday.ok) {
        return NextResponse.json({ reply: `Stuck deals error: ${monday.error}` }, { status: 200 });
      }

      const rows = monday.summary.stuck_deals || [];
      const lines: string[] = [];
      lines.push(`Stuck deals: ${rows.length}`);
      if (rows.length) {
        lines.push("");
        for (const deal of rows.slice(0, 10)) {
          lines.push(
            `- ${deal.opportunity_name || "Unnamed deal"} • ${deal.stage || "Unstaged"} • ${money(Number(deal.weighted_amount || deal.amount || 0))} • ${deal.days_since_activity || 0} days idle`
          );
        }
      } else {
        lines.push("No stuck deals surfaced right now.");
      }
      lines.push("");
      lines.push("Open the drilldown: /dashboard/reports/weekly");
      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutEnterpriseBlockers(raw)) {
      const monday = await fetchCeoMondaySummary(accountId);
      if (!monday.ok) {
        return NextResponse.json({ reply: `Enterprise blocker error: ${monday.error}` }, { status: 200 });
      }

      const rows = monday.summary.enterprise_blockers || [];
      const lines: string[] = [];
      lines.push(`Enterprise blockers: ${rows.length}`);
      if (rows.length) {
        lines.push("");
        for (const deal of rows.slice(0, 10)) {
          const blockers = [
            deal.missing_budget ? "budget" : null,
            deal.missing_timeline ? "timeline" : null,
            deal.missing_decision_maker ? "decision maker" : null,
          ]
            .filter(Boolean)
            .join(", ");
          lines.push(
            `- ${deal.opportunity_name || "Unnamed deal"} • ${money(Number(deal.weighted_amount || 0))} • missing ${blockers || "core info"}`
          );
        }
      } else {
        lines.push("No enterprise blockers surfaced right now.");
      }
      lines.push("");
      lines.push("Open the weekly briefing: /dashboard/reports/weekly");
      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutLeadFlow(raw)) {
      const leads = await fetchLeadDigest(supabase, accountId);
      if (!leads.ok) {
        return NextResponse.json({ reply: `Lead flow error: ${leads.error}` }, { status: 200 });
      }

      const lines: string[] = [];
      lines.push("Lead flow:");
      lines.push(`- Total leads: ${leads.total}`);
      lines.push(`- New leads: ${leads.newLeads}`);
      lines.push(`- High-score leads (80+): ${leads.highScore}`);
      lines.push(`- Follow-ups due: ${leads.followUpDue}`);
      lines.push(`- Responded outreach: ${leads.responded}`);
      lines.push("");
      lines.push("Best next move: work due follow-ups first, then high-score uncontacted leads.");
      lines.push("Open lead generator: /dashboard/lead-generation");
      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutPipeline(raw)) {
      const p = await fetchPipelineSummary(supabase, accountId, 30);
      const monday = await fetchCeoMondaySummary(accountId);

      if (!p.ok) return NextResponse.json({ reply: `Pipeline error: ${p.error}` }, { status: 200 });

      const lines: string[] = [];
      lines.push(`Pipeline (last ${p.rangeDays} days):`);
      lines.push(`- Total opportunities created: ${p.total}`);
      lines.push(`- Open deals: ${p.openCount} totaling ${money(p.openTotal)}`);

      if (monday.ok && monday.summary.kpis) {
        lines.push(`- Weighted pipeline: ${money(Number(monday.summary.kpis.weighted_pipeline_all || 0))}`);
      }

      if (p.topStages.length) {
        lines.push("");
        lines.push("Top stages by $:");
        for (const s of p.topStages) {
          lines.push(`- ${s.stage}: ${s.count} deals, ${money(s.total)}`);
        }
      }

      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutOverdue(raw)) {
      const o = await fetchOverdueSummary(supabase, accountId);
      if (!o.ok) return NextResponse.json({ reply: `Overdue error: ${o.error}` }, { status: 200 });

      const lines: string[] = [];
      lines.push(`Overdue tasks: ${o.overdue} (Blocked: ${o.blocked})`);
      if (o.sample.length) {
        lines.push("");
        lines.push("Next up:");
        for (const t of o.sample) {
          const due = t.due_at ? new Date(t.due_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT" : "No due date";
          lines.push(`- ${t.title} (${t.status || "New"}) — ${due}`);
        }
      }
      lines.push("");
      lines.push("Open the drilldown: /dashboard/reports/overdue");
      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutProjects(raw)) {
      const pr = await fetchProjectHealthSummary(supabase, accountId);
      if (!pr.ok) return NextResponse.json({ reply: `Project health error: ${pr.error}` }, { status: 200 });

      const lines: string[] = [];
      lines.push(`Project Health:`);
      lines.push(`- Total projects: ${pr.total}`);
      lines.push(`- RED ${pr.counts.RED}, YELLOW ${pr.counts.YELLOW}, GREEN ${pr.counts.GREEN}, UNKNOWN ${pr.counts.UNKNOWN}`);
      if (pr.topReds.length) {
        lines.push("");
        lines.push("At-risk projects (RED):");
        for (const x of pr.topReds) lines.push(`- ${x.name}`);
      }
      lines.push("");
      lines.push("Open the heatmap: /dashboard/reports/projects-health");
      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    if (isQuestionAboutMeetings(raw)) {
      const lower = raw.toLowerCase();
      const range: "today" | "week" | "7" | "30" =
        lower.includes("today") ? "today" :
        lower.includes("this week") || lower.includes("week") ? "week" :
        lower.includes("30") ? "30" :
        "7";

      const m = await fetchMeetingsSummary(supabase, accountId, range);
      if (!m.ok) return NextResponse.json({ reply: `Meetings error: ${m.error}` }, { status: 200 });

      const label = range === "7" ? "last 7 days" : range === "30" ? "last 30 days" : range === "week" ? "this week" : "today";
      const lines: string[] = [];
      lines.push(`Meetings booked (${label}): ${m.count}`);
      if (m.sample.length) {
        lines.push("");
        lines.push("Most recent:");
        for (const x of m.sample) {
          const when = x.scheduled_at ? new Date(x.scheduled_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT" : "N/A";
          lines.push(`- ${x.who} — ${when} (${x.status || "scheduled"})`);
        }
      }
      lines.push("");
      lines.push("Open meetings: /dashboard/meetings");
      return NextResponse.json({ reply: lines.join("\n") }, { status: 200 });
    }

    return NextResponse.json(
      {
        reply:
          "I can answer from Freshware across pipeline, stuck deals, enterprise blockers, projects health, meetings, tasks, and lead flow.\n\n" +
          "Try:\n" +
          "- What should I focus on today?\n" +
          "- Show stuck deals\n" +
          "- Which enterprise deals are blocked?\n" +
          "- Summarize pipeline\n" +
          "- Show overdue tasks\n" +
          "- Project health status\n" +
          "- Meetings booked last 7 days\n" +
          "- Lead flow\n\n" +
          "Or create an action:\n" +
          "- Create a task: Follow up with top 3 prospects (under Sales) due Friday 2pm CST",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ reply: `Agent error: ${e?.message || "Unknown error"}` }, { status: 200 });
  }
}