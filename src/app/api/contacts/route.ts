import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const name = (body?.name || "").toString().trim();
  const email = body?.email ? String(body.email).trim() : null;
  const phone = body?.phone ? String(body.phone).trim() : null;
  const title = body?.title ? String(body.title).trim() : null;
  const company_id = body?.company_id ? String(body.company_id).trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const account_id = profile.account_id;
  if (!account_id) {
    return NextResponse.json({ error: "No account_id available for this user" }, { status: 400 });
  }

  if (company_id) {
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .eq("account_id", account_id)
      .maybeSingle();

    if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 });
    if (!company) {
      return NextResponse.json({ error: "Selected company not found." }, { status: 400 });
    }
  }

  const insertRow = {
    name,
    email,
    phone,
    title,
    company_id,
    account_id,
    owner_profile_id: user.id,
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert([insertRow])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 200 });
}