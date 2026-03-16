import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const update: any = {};
  if ("name" in body) update.name = body.name ? String(body.name).trim() : null;
  if ("email" in body) update.email = body.email ? String(body.email).trim() : null;
  if ("phone" in body) update.phone = body.phone ? String(body.phone).trim() : null;
  if ("title" in body) update.title = body.title ? String(body.title).trim() : null;
  if ("company_id" in body) update.company_id = body.company_id ? String(body.company_id).trim() : null;

  if ("name" in update && !update.name) {
    return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
  }

  if ("company_id" in update && update.company_id) {
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", update.company_id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 });
    if (!company) {
      return NextResponse.json({ error: "Selected company not found." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(update)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 200 });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { id } = await context.params;

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("account_id", profile.account_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}