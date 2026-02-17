import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const update: any = {};

  if ("name" in body) update.name = body.name ? String(body.name).trim() : null;
  if ("stage" in body) update.stage = body.stage ? String(body.stage).trim() : null;

  if ("serviceLine" in body) update.service_line = body.serviceLine ? String(body.serviceLine).trim() : null;
  if ("service_line" in body) update.service_line = body.service_line ? String(body.service_line).trim() : null;

  if ("amount" in body) update.amount = typeof body.amount === "number" ? body.amount : Number(body.amount) || 0;
  if ("probability" in body) update.probability = body.probability == null ? null : Number(body.probability) || 0;

  if ("close_date" in body) update.close_date = body.close_date ? new Date(body.close_date).toISOString() : null;
  if ("closeDate" in body) update.close_date = body.closeDate ? new Date(body.closeDate).toISOString() : null;

  if ("contact_id" in body) update.contact_id = body.contact_id ? String(body.contact_id) : null;

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  if (isAdmin && "account_id" in body) update.account_id = body.account_id || null;

  // Optional: record last activity timestamp anytime a change happens
  update.last_activity_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("opportunities")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opportunity: data }, { status: 200 });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await context.params;

  const patch = {
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
  };

  const { error } = await supabase
    .from("opportunities")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
