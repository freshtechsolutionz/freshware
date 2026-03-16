import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ companies: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = body?.name ? String(body.name).trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const insertRow = {
    account_id: profile.account_id,
    name,
    legal_name: body?.legal_name ? String(body.legal_name).trim() : null,
    website: body?.website ? String(body.website).trim() : null,
    linkedin_url: body?.linkedin_url ? String(body.linkedin_url).trim() : null,
    email: body?.email ? String(body.email).trim() : null,
    phone: body?.phone ? String(body.phone).trim() : null,
    city: body?.city ? String(body.city).trim() : null,
    state: body?.state ? String(body.state).trim() : null,
    country: body?.country ? String(body.country).trim() : null,
    industry: body?.industry ? String(body.industry).trim() : null,
    customer_segment: body?.customer_segment ? String(body.customer_segment).trim() : null,
    lifecycle_stage: body?.lifecycle_stage ? String(body.lifecycle_stage).trim() : null,
    priority_level: body?.priority_level ? String(body.priority_level).trim() : null,
    internal_account_owner: body?.internal_account_owner ? String(body.internal_account_owner).trim() : null,
    primary_business_goals: body?.primary_business_goals ? String(body.primary_business_goals).trim() : null,
    top_pain_points: body?.top_pain_points ? String(body.top_pain_points).trim() : null,
  };

  const { data, error } = await supabase
    .from("companies")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ company: data }, { status: 201 });
}