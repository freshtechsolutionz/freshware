import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

const TASK_STATUSES = ["New", "In Progress", "Done", "Blocked"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

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

function canEdit(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "OPS", "SALES", "STAFF", "MARKETING"].includes(r);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canEdit(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  const patch: any = {};
  if ("title" in body) patch.title = body.title ? String(body.title).trim() : null;
  if ("description" in body) patch.description = body.description ? String(body.description).trim() : null;
  if ("due_at" in body) patch.due_at = body.due_at ? new Date(body.due_at).toISOString() : null;
  if ("assigned_to" in body) patch.assigned_to = body.assigned_to ? String(body.assigned_to) : null;
  if ("status" in body) patch.status = normalizeStatus(body.status);

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("task_id", id)
    .eq("account_id", accountId)
    .select(
      "task_id, title, description, status, due_at, opportunity_id, project_id, assigned_to, created_by, created_at, updated_at, account_id"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data }, { status: 200 });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = (profile.role || "").toUpperCase();
  const canDelete = role === "CEO" || role === "ADMIN" || role === "OPS";
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("task_id", id)
    .eq("account_id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
