import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function isAdmin(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return r === "CEO" || r === "ADMIN";
}

function normalizeDateOnly(v: any) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (isNaN(d.getTime())) return null;

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeNumber(v: any) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = {};

  if ("title" in body) patch.title = body.title ? String(body.title).trim() : null;
  if ("description" in body) patch.description = body.description ? String(body.description).trim() : null;
  if ("amount" in body) patch.amount = normalizeNumber(body.amount);
  if ("type" in body) patch.type = body.type ? String(body.type).trim() : null;
  if ("revenue_type" in body) patch.revenue_type = body.revenue_type ? String(body.revenue_type).trim() : null;
  if ("category" in body) patch.category = body.category ? String(body.category).trim() : null;
  if ("status" in body) patch.status = body.status ? String(body.status).trim() : null;
  if ("paid" in body) patch.paid = Boolean(body.paid);
  if ("payment_method" in body) patch.payment_method = body.payment_method ? String(body.payment_method).trim() : null;
  if ("invoice_number" in body) patch.invoice_number = body.invoice_number ? String(body.invoice_number).trim() : null;
  if ("external_ref" in body) patch.external_ref = body.external_ref ? String(body.external_ref).trim() : null;
  if ("frequency" in body) patch.frequency = body.frequency ? String(body.frequency).trim() : null;
  if ("source" in body) patch.source = body.source ? String(body.source).trim() : null;

  if ("recognized_on" in body) patch.recognized_on = normalizeDateOnly(body.recognized_on);
  if ("entry_date" in body) patch.entry_date = normalizeDateOnly(body.entry_date);
  if ("start_date" in body) patch.start_date = normalizeDateOnly(body.start_date);
  if ("end_date" in body) patch.end_date = normalizeDateOnly(body.end_date);

  if ("company_id" in body) patch.company_id = body.company_id ? String(body.company_id).trim() : null;
  if ("project_id" in body) patch.project_id = body.project_id ? String(body.project_id).trim() : null;
  if ("opportunity_id" in body) patch.opportunity_id = body.opportunity_id ? String(body.opportunity_id).trim() : null;

  const { data, error } = await supabase
    .from("revenue_entries")
    .update(patch)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ revenue: data }, { status: 200 });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isAdmin(profile.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await context.params;

  const { error } = await supabase
    .from("revenue_entries")
    .delete()
    .eq("id", id)
    .eq("account_id", profile.account_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}