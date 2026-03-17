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

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const { id } = await context.params;

  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .select("id, account_id, company_id, amount, stage, close_date, name")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  if (String(opp.stage || "").toLowerCase() !== "won") {
    return NextResponse.json({ error: "Revenue can only be synced for won opportunities." }, { status: 400 });
  }

  const amount = Number(opp.amount || 0);
  if (amount <= 0) {
    return NextResponse.json({ error: "Won opportunity must have a positive amount." }, { status: 400 });
  }

  const recognizedOn = normalizeDateOnly(opp.close_date) || normalizeDateOnly(new Date().toISOString());

  const { data: existing, error: existingErr } = await supabase
    .from("revenue_entries")
    .select("id")
    .eq("account_id", profile.account_id)
    .eq("opportunity_id", opp.id)
    .eq("source", "opportunity")
    .eq("frequency", "one_time")
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from("revenue_entries")
      .update({
        title: opp.name ? `${opp.name} Revenue` : "Won Opportunity Revenue",
        amount,
        recognized_on: recognizedOn,
        revenue_type: "project",
        category: "development",
        status: "recognized",
        source: "opportunity",
        frequency: "one_time",
        company_id: opp.company_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ revenue: updated, mode: "updated" }, { status: 200 });
  }

  const { data: created, error: createErr } = await supabase
    .from("revenue_entries")
    .insert({
      account_id: profile.account_id,
      company_id: opp.company_id || null,
      opportunity_id: opp.id,
      revenue_type: "project",
      category: "development",
      title: opp.name ? `${opp.name} Revenue` : "Won Opportunity Revenue",
      description: "Auto-generated from won opportunity.",
      amount,
      recognized_on: recognizedOn,
      status: "recognized",
      source: "opportunity",
      frequency: "one_time",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

  return NextResponse.json({ revenue: created, mode: "created" }, { status: 201 });
}