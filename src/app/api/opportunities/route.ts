import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const name = body?.name ? String(body.name).trim() : "";
    const stage = body?.stage ? String(body.stage).trim() : null;
    const serviceLine = body?.serviceLine ? String(body.serviceLine).trim() : null;
    const amount = body?.amount == null ? 0 : Number(body.amount) || 0;
    const company_id = body?.company_id ? String(body.company_id).trim() : null;
    const contact_id = body?.contact_id ? String(body.contact_id).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }
    if (!serviceLine) {
      return NextResponse.json({ error: "Missing required field: serviceLine" }, { status: 400 });
    }

    if (!profile.account_id) {
      return NextResponse.json(
        { error: "Your profile is missing account_id. Assign your user to an account first." },
        { status: 400 }
      );
    }

    if (!company_id) {
      return NextResponse.json({ error: "company_id is required" }, { status: 400 });
    }

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (companyErr) {
      return NextResponse.json({ error: companyErr.message }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json({ error: "Selected company not found." }, { status: 400 });
    }

    if (contact_id) {
      const { data: contact, error: contactErr } = await supabase
        .from("contacts")
        .select("id, company_id")
        .eq("id", contact_id)
        .eq("account_id", profile.account_id)
        .maybeSingle();

      if (contactErr) {
        return NextResponse.json({ error: contactErr.message }, { status: 500 });
      }
      if (!contact) {
        return NextResponse.json({ error: "Selected contact not found." }, { status: 400 });
      }
      if (contact.company_id && contact.company_id !== company_id) {
        return NextResponse.json(
          { error: "Selected contact belongs to a different company profile." },
          { status: 400 }
        );
      }
    }

    const insertRow: any = {
      name,
      stage,
      service_line: serviceLine,
      amount,
      account_id: profile.account_id,
      company_id,
      contact_id,
      owner_user_id: user.id,
      last_activity_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("opportunities")
      .insert(insertRow)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ opportunity: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}