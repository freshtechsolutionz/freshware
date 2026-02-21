import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type YcbmPayload = {
  account_id: string;            // you will include this in the webhook payload
  owner_profile_id?: string;     // optional: which staff got the meeting
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
  [k: string]: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function toIso(date?: string, time?: string, tz?: string) {
  // webhook often gives local date/time; we’ll store best-effort ISO
  // If your payload already provides ISO timestamps, prefer those.
  if (!date || !time) return null;
  // naive compose (still useful for sorting); keep timezone separately
  return new Date(`${date}T${time}`).toISOString();
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-freshware-secret") || "";
    if (secret !== mustEnv("FRESHWARE_WEBHOOK_SECRET")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as YcbmPayload;

    const accountId = (body.account_id || "").trim();
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

    const email = (body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 1) Upsert contact by (account_id + email)
    const firstName = (body.firstName || "").trim() || null;
    const lastName = (body.lastName || "").trim() || null;

    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .maybeSingle();

    let contactId = existing?.id as string | undefined;

    if (!contactId) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: (body.phone || "").trim() || null,
          source: "ycbm",
          source_ref: body.booking_id || body.booking_ref || null,
          imported_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          owner_profile_id: body.owner_profile_id || null,
        })
        .select("id")
        .single();

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      contactId = inserted.id;
    } else {
      await supabase
        .from("contacts")
        .update({
          last_seen_at: new Date().toISOString(),
          phone: (body.phone || "").trim() || null,
          owner_profile_id: body.owner_profile_id || null,
          source: "ycbm",
          source_ref: body.booking_id || body.booking_ref || null,
        })
        .eq("id", contactId);
    }

    // 2) Insert meeting row (store raw payload too)
    const startAt = toIso(body.startDate, body.startTime, body.timeZone);
    const endAt = toIso(body.endDate, body.endTime, body.timeZone);

    const { error: meetErr } = await supabase.from("meetings").insert({
      account_id: accountId,
      booked_at: new Date().toISOString(),
      start_at: startAt,
      end_at: endAt,
      timezone: body.timeZone || null,
      status: body.status || "booked",
      booking_id: body.booking_id || null,
      booking_ref: body.booking_ref || null,
      booking_page: body.booking_page || null,
      event_type: body.event_type || null,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: (body.phone || "").trim() || null,
      raw: body,
      contact_id: contactId,
      owner_profile_id: body.owner_profile_id || null,
    });

    if (meetErr) return NextResponse.json({ error: meetErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, contact_id: contactId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
