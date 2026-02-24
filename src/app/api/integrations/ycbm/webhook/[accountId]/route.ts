import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Payload = {
  event?: string; // booking_created, booking_cancelled, etc.
  external_id?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  start_iso?: string;
  end_iso?: string;
  timeZone?: string;
  booking_page?: string;
  event_type?: string;
  raw?: any; // optional
  [k: string]: any;
};

function normEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function normText(v: any) {
  const s = String(v || "").trim();
  return s ? s : null;
}

export async function POST(req: Request, context: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await context.params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Look up integration row for this account
    const { data: integration, error: integErr } = await supabase
      .from("account_integrations")
      .select("webhook_secret,status")
      .eq("account_id", accountId)
      .eq("provider", "youcanbookme")
      .maybeSingle();

    if (integErr) return NextResponse.json({ error: integErr.message }, { status: 500 });
    if (!integration || integration.status !== "connected") {
      return NextResponse.json({ error: "Integration not connected" }, { status: 404 });
    }

    // 2) Verify secret
    const secret = req.headers.get("x-ycbm-secret") || req.headers.get("x-freshware-secret");
    if (!secret || secret !== integration.webhook_secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3) Read payload
    const body = (await req.json()) as Payload;

    const external_id = normText(body.external_id);
    const start_iso = normText(body.start_iso);
    const end_iso = normText(body.end_iso);
    const email = normEmail(body.contact_email);

    if (!external_id || !start_iso) {
      return NextResponse.json({ error: "Missing external_id or start_iso" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Missing contact_email" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // 4) Upsert contact (by account_id + email)
    let contactId: string | null = null;

    const { data: existingContact, error: contactLookupErr } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .maybeSingle();

    if (contactLookupErr) {
      return NextResponse.json({ error: contactLookupErr.message }, { status: 500 });
    }

    const contactName = normText(body.contact_name) || email;

    if (!existingContact?.id) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          name: contactName,
          email,
          phone: normText(body.contact_phone),
          source: "youcanbookme",
          source_ref: external_id,
          imported_at: nowIso,
          last_seen_at: nowIso,
        })
        .select("id")
        .single();

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      contactId = inserted.id;
    } else {
      contactId = existingContact.id;

      const { error: updErr } = await supabase
        .from("contacts")
        .update({
          name: contactName,
          phone: normText(body.contact_phone),
          source: "youcanbookme",
          source_ref: external_id,
          last_seen_at: nowIso,
        })
        .eq("id", contactId);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // 5) Upsert meeting (and link contact_id)
    const status =
      body.event === "booking_cancelled" || body.event === "booking_canceled"
        ? "canceled"
        : "scheduled";

    const meetingRow: any = {
      external_id,
      account_id: accountId,
      status,
      source: "youcanbookme",
      scheduled_at: start_iso,

      // these columns exist in your meetings table
      start_at: start_iso,
      end_at: end_iso,
      timezone: normText(body.timeZone),
      booking_page: normText(body.booking_page),
      event_type: normText(body.event_type),

      contact_name: contactName,
      contact_email: email,

      // you also have these duplicate-ish columns:
      email,
      phone: normText(body.contact_phone),

      booked_at: nowIso,
      contact_id: contactId,
      raw: body, // store everything so we can render extra booking form answers later
    };

    const { error: meetErr } = await supabase
      .from("meetings")
      .upsert(meetingRow, { onConflict: "external_id" });

    if (meetErr) return NextResponse.json({ error: meetErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, contact_id: contactId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
