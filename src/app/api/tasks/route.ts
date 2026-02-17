import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

const TASK_STATUSES = ["New", "In Progress", "Done", "Blocked"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function normalizeStatus(input: any): TaskStatus {
  const s = String(input || "").trim();

  if ((TASK_STATUSES as readonly string[]).includes(s)) return s as TaskStatus;

  const lower = s.toLowerCase();
  if (lower === "open" || lower === "new" || lower === "todo") return "New";
  if (lower === "in progress" || lower === "in_progress" || lower === "doing") return "In Progress";
  if (lower === "done" || lower === "completed" || lower === "closed") return "Done";
  if (lower === "blocked" || lower === "stuck") return "Blocked";

  return "New";
}

// GET /api/tasks?project_id=...&opportunity_id=...
export async function GET(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const staff = isStaff(profile.role);

  const url = new URL(req.url);
  const project_id = url.searchParams.get("project_id");
  const opportunity_id = url.searchParams.get("opportunity_id");

  let q = supabase
    .from("tasks")
    .select(
      "task_id, title, description, status, due_at, opportunity_id, project_id, assigned_to, created_by, created_at, updated_at, account_id"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (project_id) q = q.eq("project_id", project_id);
  if (opportunity_id) q = q.eq("opportunity_id", opportunity_id);

  // ✅ OPTION 2 enforcement: clients only see tasks assigned to themselves
  if (!staff) {
    q = q.eq("assigned_to", user.id);
  }

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clients should not create tasks
  const staff = isStaff(profile.role);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
  }

  const account_id = profile.account_id;
  if (!account_id) {
    return NextResponse.json({ error: "No account_id available for this user" }, { status: 400 });
  }

  const status = normalizeStatus(body?.status);

  const description =
    body?.description === null || body?.description === undefined
      ? null
      : String(body.description).trim() || null;

  const due_at = body?.due_at ? new Date(body.due_at).toISOString() : null;

  const opportunity_id = body?.opportunity_id ? String(body.opportunity_id) : null;
  const project_id = body?.project_id ? String(body.project_id) : null;

  const assigned_to = body?.assigned_to ? String(body.assigned_to) : null;

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        title,
        description,
        status,
        due_at,
        opportunity_id,
        project_id,
        assigned_to,
        account_id,
        created_by: user.id,
      },
    ])
    .select("task_id, title, description, status, due_at, opportunity_id, project_id, assigned_to, created_by, created_at, updated_at, account_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 200 });
}
