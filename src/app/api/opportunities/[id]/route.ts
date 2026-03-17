import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isAdmin(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return r === "CEO" || r === "ADMIN";
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
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

  const { data: existing, error: existingErr } = await supabase
    .from("opportunities")
    .select("id, account_id, company_id")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  const update: Record<string, any> = {};

  if ("name" in body) update.name = body.name ? String(body.name).trim() : null;
  if ("stage" in body) update.stage = body.stage ? String(body.stage).trim() : null;

  if ("serviceLine" in body) update.service_line = body.serviceLine ? String(body.serviceLine).trim() : null;
  if ("service_line" in body) update.service_line = body.service_line ? String(body.service_line).trim() : null;

  if ("amount" in body) {
    update.amount = typeof body.amount === "number" ? body.amount : Number(body.amount) || 0;
  }

  if ("probability" in body) {
    update.probability = body.probability == null ? null : Number(body.probability) || 0;
  }

  if ("close_date" in body) {
    update.close_date = body.close_date ? String(body.close_date).slice(0, 10) : null;
  }
  if ("closeDate" in body) {
    update.close_date = body.closeDate ? String(body.closeDate).slice(0, 10) : null;
  }

  if ("company_id" in body) {
    update.company_id = body.company_id ? String(body.company_id).trim() : null;
  }

  if ("contact_id" in body) {
    update.contact_id = body.contact_id ? String(body.contact_id).trim() : null;
  }

  const targetCompanyId =
    "company_id" in update ? update.company_id : existing.company_id;

  if ("company_id" in update) {
    if (!update.company_id) {
      return NextResponse.json({ error: "company_id is required" }, { status: 400 });
    }

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", update.company_id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (companyErr) {
      return NextResponse.json({ error: companyErr.message }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json({ error: "Selected company not found." }, { status: 400 });
    }
  }

  if ("contact_id" in update && update.contact_id) {
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("id, company_id")
      .eq("id", update.contact_id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (contactErr) {
      return NextResponse.json({ error: contactErr.message }, { status: 500 });
    }
    if (!contact) {
      return NextResponse.json({ error: "Selected contact not found." }, { status: 400 });
    }
    if (targetCompanyId && contact.company_id && contact.company_id !== targetCompanyId) {
      return NextResponse.json(
        { error: "Selected contact belongs to a different company profile." },
        { status: 400 }
      );
    }
  }

  const adminUser = isAdmin(profile.role);
  if (adminUser && "account_id" in body) {
    update.account_id = body.account_id || null;
  }

  update.last_activity_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("opportunities")
    .update(update)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opportunity: data }, { status: 200 });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }
  if (!isAdmin(profile.role)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await context.params;

  const { data: existing, error: existingErr } = await supabase
    .from("opportunities")
    .select("id, name, account_id")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const accountId = profile.account_id;

  // Clean up linked records that should disappear with test/fake opportunities
  const cleanupResults = await Promise.all([
    supabase
      .from("tasks")
      .delete()
      .eq("account_id", accountId)
      .eq("opportunity_id", id),

    supabase
      .from("revenue_entries")
      .delete()
      .eq("account_id", accountId)
      .eq("opportunity_id", id),
  ]);

  for (const result of cleanupResults) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }

  // Soft delete the opportunity itself
  const { error } = await supabase
    .from("opportunities")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("account_id", accountId)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      ok: true,
      message: `Opportunity "${existing.name || id}" deleted successfully.`,
    },
    { status: 200 }
  );
}