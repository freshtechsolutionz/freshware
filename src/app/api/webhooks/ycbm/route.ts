import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type YcbmPayload = {
  // allow multiple possible shapes from YCBM
  account_id?: string;
  owner_profile_id?: string;

  booking_id?: string;
  booking_ref?: string;
  status?: string;

  timeZone?: string;
  startsAt?: string; // often ISO date OR date string
  endsAt?: string;

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

function cleanEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function cleanPhone(v: any) {
  const s = String(v || "").trim();
  return s || null;
}

function fullName(first?: string, last?: string) {
  const f = String(first || "").trim();
  const l = String(last || "").trim();
  const n = `${f} ${l}`.trim();
  return n || null;
}

function toIsoFromParts(date?: string, time?: string) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function toIsoBestEffort(body: YcbmPayload, which: "start" | "end") {
  // prefer ISO if provided
  const iso = which === "start" ? body.startsAt : body.endsAt;
  if (iso) {
    const d = new Date(iso);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }

  // fallback to date+time parts
  if (which === "start") return toIsoFromParts(body.startDate, body.startTime);
  return toIsoFromParts(body.endDate, body.endTime);
}

export async function POST(req: Request) {
  try {
    // 1) Verify secret header
    const secret = req.headers.get("x-freshware-secret") || "";
    if (secret !== mustEnv("FRESHWARE_WEBHOOK_SECRET")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) Read payload + also allow querystring account_id/owner_profile_id
    const url = new URL(req.url);
    const qsAccountId = (url.searchParams.get("account_id") || "").trim();
    const qsOwnerProfileId = (url.searchParams.get("owner_profile_id") || "").trim();

    const body = (await req.json().catch(() => ({}))) as YcbmPayload;

    const accountId = (qsAccountId || body.account_id || "").trim();
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });

    const ownerProfileId = (qsOwnerProfileId || body.owner_profile_id || "").trim() || null;

    const email = cleanEmail(body.email);
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 3) UPSERT contact (using the columns your UI uses)
    //    contacts table UI expects: id, name, email, phone, account_id, created_at
    const name = fullName(body.firstName, body.lastName);
    const phone = cleanPhone(body.phone);

    // find existing contact by (account_id + email)
    const { data: existingContact, error: findErr } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: `Contact lookup failed: ${findErr.message}` }, { status: 400 });
    }

    let contactId: string | null = existingContact?.id ?? null;

    if (!contactId) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          name,
          email,
          phone,
        })
        .select("id")
        .single();

      if (insErr) {
        return NextResponse.json({ error: `Contact insert failed: ${insErr.message}` }, { status: 400 });
      }

      contactId = inserted.id;
    } else {
      const { error: updErr } = await supabase
        .from("contacts")
        .update({
          name,
          phone,
        })
        .eq("id", contactId);

      if (updErr) {
        return NextResponse.json({ error: `Contact update failed: ${updErr.message}` }, { status: 400 });
      }
    }

    // 4) Insert meeting row (and include a marker so we can prove this route handled it)
    const startAt = toIsoBestEffort(body, "start");
    const endAt = toIsoBestEffort(body, "end");

    const rawWithMarker = {
      ...body,
      freshware_source: "ycbm_webhook_v2",
      freshware_received_at: new Date().toISOString(),
      freshware_account_id: accountId,
      freshware_owner_profile_id: ownerProfileId,
    };

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
      first_name: (body.firstName || "").trim() || null,
      last_name: (body.lastName || "").trim() || null,
      email,
      phone,
      raw: rawWithMarker,
      contact_id: contactId,
      owner_profile_id: ownerProfileId,
    });

    if (meetErr) {
      return NextResponse.json({ error: `Meeting insert failed: ${meetErr.message}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, contact_id: contactId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
