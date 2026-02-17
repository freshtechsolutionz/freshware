import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
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

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  // Confirm project belongs to this account
  const check = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (check.error) return NextResponse.json({ error: check.error.message }, { status: 500 });
  if (!check.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Allow-list fields
  const patch: any = {};
  if ("stage" in body) patch.stage = body.stage ? String(body.stage) : null;
  if ("status" in body) patch.status = body.status ? String(body.status) : null;
  if ("health" in body) patch.health = body.health ? String(body.health) : null;
  if ("due_date" in body) patch.due_date = body.due_date ? String(body.due_date) : null;
  if ("start_date" in body) patch.start_date = body.start_date ? String(body.start_date) : null;
  if ("description" in body) patch.description = body.description ? String(body.description) : null;
  if ("internal_notes" in body) patch.internal_notes = body.internal_notes ? String(body.internal_notes) : null;

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .eq("account_id", accountId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, project: data }, { status: 200 });
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

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("account_id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
