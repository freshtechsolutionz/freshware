import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
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

export async function GET() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("revenue_entries")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("recognized_on", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ revenue: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const title = body?.title ? String(body.title).trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const amount = normalizeNumber(body?.amount);
  if (amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
  }

  const row = {
    account_id: profile.account_id,
    company_id: body?.company_id ? String(body.company_id).trim() : null,
    project_id: body?.project_id ? String(body.project_id).trim() : null,
    opportunity_id: body?.opportunity_id ? String(body.opportunity_id).trim() : null,
    type: body?.type ? String(body.type).trim() : null,
    revenue_type: body?.revenue_type ? String(body.revenue_type).trim() : "manual",
    category: body?.category ? String(body.category).trim() : null,
    title,
    description: body?.description ? String(body.description).trim() : null,
    amount,
    entry_date: normalizeDateOnly(body?.entry_date) || normalizeDateOnly(body?.recognized_on) || normalizeDateOnly(new Date().toISOString()),
    recognized_on: normalizeDateOnly(body?.recognized_on) || normalizeDateOnly(body?.entry_date) || normalizeDateOnly(new Date().toISOString()),
    paid: typeof body?.paid === "boolean" ? body.paid : false,
    status: body?.status ? String(body.status).trim() : "pending",
    payment_method: body?.payment_method ? String(body.payment_method).trim() : null,
    invoice_number: body?.invoice_number ? String(body.invoice_number).trim() : null,
    external_ref: body?.external_ref ? String(body.external_ref).trim() : null,
    frequency: body?.frequency ? String(body.frequency).trim() : "one_time",
    start_date: normalizeDateOnly(body?.start_date),
    end_date: normalizeDateOnly(body?.end_date),
    source: body?.source ? String(body.source).trim() : "manual",
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("revenue_entries")
    .insert(row)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ revenue: data }, { status: 201 });
}