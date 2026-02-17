import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AgentRequest = {
  message: string;
};

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
  return { ok: true as const, user: auth.user, profile: profile as ProfileRow };
}

function normalizeBucketName(input: string) {
  const s = (input || "").trim().toLowerCase();
  if (!s) return "Admin";
  if (s.includes("admin")) return "Admin";
  if (s.includes("general")) return "Admin";
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

function nowIso() {
  return new Date().toISOString();
}

/**
 * Convert "Friday 2pm CST" into UTC ISO using America/Chicago.
 * If parsing fails, return null (due date optional).
 */
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

  const targetIdx = 5; // Fri
  let delta = targetIdx - todayIdx;
  if (delta < 0) delta += 7;
  if (delta === 0) delta = 7;

  const intendedUtc = new Date(Date.UTC(yyyy, mm - 1, dd + delta, hour24, minRaw, 0));

  // DST-safe correction: ensure this UTC corresponds to desired wall time in Chicago
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

/**
 * Create a bucket project safely:
 * - DO NOT set stage (your enum rejects Admin/Sales/etc).
 * - Try minimal insert, then retry with additional columns only if required.
 */
async function getOrCreateProjectByName(accountId: string, viewerId: string, name: string) {
  const svc = svcSupabase();
  if (!svc) return { ok: false as const, error: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" };

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

  // Attempt 1: minimal insert, no enums
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

  // Attempt 2: if schema requires health/status (and they are NOT enums), add safe strings.
  // If they are enums, this might still fail, but then we return the exact error.
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
  if (!svc) return { ok: false as const, error: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" };

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

  // Basic auto-repair and retry once
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentRequest;
    const raw = String(body?.message || "").trim();
    if (!raw) return NextResponse.json({ reply: "Type a message and I’ll respond." }, { status: 200 });

    const viewer = await getViewer();
    if (!viewer.ok) return NextResponse.json({ reply: "You must be logged in to use the agent." }, { status: 200 });

    const { user, profile } = viewer;
    if (!profile.account_id) return NextResponse.json({ reply: "Your profile is missing account_id." }, { status: 200 });

    if (!isStaff(profile.role)) {
      return NextResponse.json(
        { reply: "You have view access only. Task creation is restricted to staff roles." },
        { status: 200 }
      );
    }

    const intent = parseCreateTaskIntent(raw);

    if (intent) {
      const result = await insertTaskWithAutoAttach({
        accountId: profile.account_id,
        viewerId: user.id,
        title: intent.title,
        due_at: intent.due_at,
        bucketName: intent.bucket,
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            reply:
              "Task not created. " +
              result.error +
              "\n\nThis is a schema constraint coming from Supabase. Paste the exact error text if you want me to harden the insert for that constraint too.",
          },
          { status: 200 }
        );
      }

      const bucketLabel = normalizeBucketName(intent.bucket);
      const dueText = result.created?.due_at
        ? ` Due: ${new Date(result.created.due_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT.`
        : "";

      return NextResponse.json(
        {
          reply: `Done. Created "${result.created.title}" under ${bucketLabel}.${dueText}`,
          created_tasks: [result.created],
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        reply:
          "Fresh AI Agent online.\n\nTry:\n- Create a task: Send Ellis new invoice (under Admin) due Friday 2pm CST\n- Create a task: Push top 3 deals (under Sales) due Friday 2pm CST",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ reply: `Agent error: ${e?.message || "Unknown error"}` }, { status: 200 });
  }
}
