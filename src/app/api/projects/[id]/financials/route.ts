import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function asNumberOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const proj = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (proj.error) return NextResponse.json({ error: proj.error.message }, { status: 500 });
  if (!proj.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("project_financials")
    .select("id, account_id, project_id, budget_total, cost_to_date, billed_to_date, paid_to_date, currency, updated_at, created_at")
    .eq("account_id", accountId)
    .eq("project_id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ financials: data || null }, { status: 200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const proj = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (proj.error) return NextResponse.json({ error: proj.error.message }, { status: 500 });
  if (!proj.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const payload: any = {
    account_id: accountId,
    project_id: id,
    budget_total: asNumberOrNull(body?.budget_total),
    cost_to_date: asNumberOrNull(body?.cost_to_date),
    billed_to_date: asNumberOrNull(body?.billed_to_date),
    paid_to_date: asNumberOrNull(body?.paid_to_date),
    currency: body?.currency ? String(body.currency).trim() : "USD",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("project_financials")
    .upsert(payload, { onConflict: "project_id" })
    .select("id, account_id, project_id, budget_total, cost_to_date, billed_to_date, paid_to_date, currency, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ financials: data }, { status: 200 });
}
