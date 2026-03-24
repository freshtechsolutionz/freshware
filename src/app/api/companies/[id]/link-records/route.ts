import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

const TABLE_BY_KIND = {
  contact: "contacts",
  opportunity: "opportunities",
  project: "projects",
} as const;

type LinkKind = keyof typeof TABLE_BY_KIND;

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  try {
    const { id: companyId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || "") as LinkKind;
    const recordId = String(body?.recordId || "");

    if (!companyId) return NextResponse.json({ error: "Missing company id" }, { status: 400 });
    if (!recordId) return NextResponse.json({ error: "Missing record id" }, { status: 400 });
    if (!(kind in TABLE_BY_KIND)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id, account_id")
      .eq("id", companyId)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const table = TABLE_BY_KIND[kind];

    let recordQuery = supabase
      .from(table)
      .select("id, account_id, company_id")
      .eq("id", recordId)
      .eq("account_id", profile.account_id);

    if (kind === "opportunity") {
      recordQuery = (recordQuery as any).is("deleted_at", null);
    }

    const { data: record, error: recordErr } = await recordQuery.maybeSingle();

    if (recordErr) return NextResponse.json({ error: recordErr.message }, { status: 500 });
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });

    const { error: updateErr } = await supabase
      .from(table)
      .update({ company_id: companyId })
      .eq("id", recordId)
      .eq("account_id", profile.account_id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("POST /api/companies/[id]/link-records error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}