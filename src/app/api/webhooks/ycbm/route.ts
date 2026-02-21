import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type YcbmPayload = {
  // Optional in Option A (we can read from query params instead)
  account_id?: string;

  // Optional in Option A (we can read from query params instead)
  owner_profile_id?: string;

  booking_id?: string;
  booking_ref?: string;
  status?: string;
  timeZone?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  booking_page?: string;
  event_type?: string;

  // Anything else from YCBM
  [k: string]: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function toIso(date?: string, time?: string) {
  if (!date || !time) return null;
  // best-effort parsing; timezone stored separately
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    // 0) Verify secret
    const secret = req.headers.get("x-freshware-secret") || "";
    if (secret !== mustEnv("FRESHWARE_WEBHOOK_SECRET")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1) Read query params (Option A)
    const url = new URL(req.url);
    const accountIdFromQuery = (url.searchParams.get("account_id") || "").trim();
    const ownerFromQuery = (url.searchParams.get("owner_profile_id") || "").trim();

    // 2) Read payload
    const body = (await req.json()) as YcbmPayload;

    // 3) Resolve account + owner
    const accountId = (body.account_id || accountIdFromQuery || "").trim();
    const ownerProfileId = (body.owner_profile_id || ownerFromQuery || "").trim() || null;

    if (!accountId) {
      return NextResponse.json({ error: "account_id required (send in query string for Option A)" }, { status: 400 });
    }

    const email = (body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 4) Upsert contact by (account_id + email)
    const firstName = (body.firstName || "").trim() || null;
    const lastName = (body.lastName || "").trim() || null;
    const phone = (body.phone || "").trim() || null;

    const { data: existingContact, error: lookupErr } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .maybeSingle();

    if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 400 });

    let contactId = (existingContact?.id as string | undefined) || undefined;

    if (!contactId) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          source: "ycbm",
          source_ref: body.booking_id || body.booking_ref || null,
          imported_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          owner_profile_id: ownerProfileId,
        })
        .select("id")
        .single();

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      contactId = inserted.id;
    } else {
      const { error: updErr } = await supabase
        .from("contacts")
        .update({
          first_name: firstName,
          last_name: lastName,
          phone,
          last_seen_at: new Date().toISOString(),
          source: "ycbm",
          source_ref: body.booking_id || body.booking_ref || null,
          owner_profile_id: ownerProfileId,
        })
        .eq("id", contactId);

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    // 5) Insert meeting row
    const startAt = toIso(body.startDate, body.startTime);
    const endAt = toIso(body.endDate, body.endTime);

    const { error: meetErr } = await supabase.from("meetings").insert({
      account_id: accountId,

      // Meeting metadata
      booked_at: new Date().toISOString(),
      start_at: startAt,
      end_at: endAt,
      timezone: body.timeZone || null,
      status: body.status || "booked",

      // YCBM references
      booking_id: body.booking_id || null,
      booking_ref: body.booking_ref || null,
      booking_page: body.booking_page || null,
      event_type: body.event_type || null,

      // Attendee
      first_name: firstName,
      last_name: lastName,
      email,
      phone,

      // Links
      contact_id: contactId,
      owner_profile_id: ownerProfileId,

      // Store raw payload for debugging
      raw: body,
    });

    if (meetErr) return NextResponse.json({ error: meetErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, contact_id: contactId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
