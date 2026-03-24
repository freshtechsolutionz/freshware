import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function getValue(body: any, key: string) {
  const v = body?.[key];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
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

  const contentType = req.headers.get("content-type") || "";
  let body: any = {};

  if (contentType.includes("application/json")) {
    body = await req.json().catch(() => ({}));
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await req.formData().catch(() => null);
    if (form) {
      body = Object.fromEntries(form.entries());
    }
  }

  const name = getValue(body, "name");

  if (!name) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const insertRow = {
    account_id: profile.account_id,
    name,
    legal_name: getValue(body, "legal_name"),
    website: getValue(body, "website"),
    linkedin_url: getValue(body, "linkedin_url"),
    email: getValue(body, "email"),
    phone: getValue(body, "phone"),
    city: getValue(body, "city"),
    state: getValue(body, "state"),
    country: getValue(body, "country"),
    industry: getValue(body, "industry"),
    customer_segment: getValue(body, "customer_segment"),
    lifecycle_stage: getValue(body, "lifecycle_stage"),
    priority_level: getValue(body, "priority_level"),
    internal_account_owner: getValue(body, "internal_account_owner"),
    primary_business_goals: getValue(body, "primary_business_goals"),
    top_pain_points: getValue(body, "top_pain_points"),
  };

  const { data, error } = await supabase
    .from("companies")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (contentType.includes("application/json")) {
    return NextResponse.json({ company: data }, { status: 201 });
  }

  return NextResponse.redirect(
    new URL(`/dashboard/companies/${data.id}?created=1`, "http://localhost:3000"),
    { status: 303 }
  );
}