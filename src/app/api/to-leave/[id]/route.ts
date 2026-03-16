import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = {};

  if ("title" in body) {
    const title = body.title ? String(body.title).trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Task title cannot be empty." }, { status: 400 });
    }
    patch.title = title;
  }

  if ("completed" in body) {
    const completed = Boolean(body.completed);
    patch.completed = completed;
    patch.completed_at = completed ? new Date().toISOString() : null;
  }

  const { data: existing, error: existingErr } = await supabase
    .from("to_leave_items")
    .select("id, owner_user_id, account_id")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "To-Leave item not found." }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from("to_leave_items")
    .update(patch)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .eq("owner_user_id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: item, error: readErr } = await supabase
    .from("to_leave_items")
    .select("id, title, completed, completed_at, created_at, updated_at")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 200 });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { id } = await context.params;

  const { error } = await supabase
    .from("to_leave_items")
    .delete()
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .eq("owner_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}