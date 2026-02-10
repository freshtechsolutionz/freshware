import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const update: any = {};
  if ("title" in body) update.title = body.title ? String(body.title).trim() : null;
  if ("description" in body)
    update.description = body.description ? String(body.description).trim() : null;
  if ("status" in body) update.status = body.status ? String(body.status).trim() : null;
  if ("due_at" in body)
    update.due_at = body.due_at ? new Date(body.due_at).toISOString() : null;
  if ("opportunity_id" in body)
    update.opportunity_id = body.opportunity_id ? String(body.opportunity_id) : null;
  if ("assigned_to" in body)
    update.assigned_to = body.assigned_to ? String(body.assigned_to) : null;

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  if (isAdmin && "account_id" in body) update.account_id = body.account_id || null;

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("task_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data }, { status: 200 });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const { error } = await supabase.from("tasks").delete().eq("task_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
