import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * This endpoint is designed to be resilient:
 * - Accepts either header: x-ycbm-secret OR x-ycmb-secret (typo in YCBM config)
 * - Accepts multiple payload formats:
 *   A) { start_iso, end_iso, external_id, contact_email, contact_name, phone, ... }
 *   B) { startDate, startTime, endDate, endTime, timeZone, booking_id, booking_ref, email, firstName, lastName, phone, ... }
 *   C) YCBM shorthand codes mis-typed: {START_ISO} etc -> we treat as missing and return 400
 */

type AnyObj = Record<string, any>;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function normalizeEmail(v: any): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? s : null;
}

function normalizePhone(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function looksLikeUnreplacedToken(v: any): boolean {
  const s = String(v ?? "").trim();
  // If YCBM sent "{START_ISO}" etc, treat as not provided
  return s.startsWith("{") && s.endsWith("}");
}

function toIsoFromLocal(date?: string, time?: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function pickFirst(...vals: any[]): any {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v.trim() : v;
    if (typeof s === "string" && s.length === 0) continue;
    return v;
  }
  return null;
}

export async function POST(req: Request, context: { params: Promise<{ accountId: string }> }) {
  const started = Date.now();
  let accountId: string | null = null;
  let statusCode = 200;
  let ok = false;
  let errorMsg: string | null = null;

  const headersObj: Record<string, string> = {};
  req.headers.forEach((v, k) => (headersObj[k] = v));

  let body: AnyObj | null = null;

  const supabase = createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"));

  async function audit(extra?: Partial<{ ok: boolean; status_code: number; error: string | null; account_id: string | null }>) {
    try {
      await supabase.from("webhook_audit").insert({
        source: "youcanbookme",
        account_id: extra?.account_id ?? accountId,
        ok: extra?.ok ?? ok,
        status_code: extra?.status_code ?? statusCode,
        error: extra?.error ?? errorMsg,
        headers: JSON.stringify(headersObj),
        body: body ? JSON.stringify(body) : null,
      });
    } catch {
      // ignore audit failures
    }
  }

  try {
    const p = await context.params;
    accountId = (p.accountId || "").trim();
    if (!accountId) {
      statusCode = 400;
      errorMsg = "Missing accountId in route";
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    // 1) Look up integration secret for this account
    const { data: integration, error: integErr } = await supabase
      .from("account_integrations")
      .select("webhook_secret,status")
      .eq("account_id", accountId)
      .eq("provider", "youcanbookme")
      .maybeSingle();

    if (integErr) {
      statusCode = 500;
      errorMsg = integErr.message;
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    if (!integration || integration.status !== "connected") {
      statusCode = 404;
      errorMsg = "Integration not connected";
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    // 2) Verify secret header (accept both spellings)
    const secret =
      req.headers.get("x-ycbm-secret") ||
      req.headers.get("x-ycmb-secret") || // <- seen in your audit
      "";

    if (!secret || secret !== integration.webhook_secret) {
      statusCode = 401;
      errorMsg = "Unauthorized (x-ycbm-secret mismatch)";
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    // 3) Read JSON body
    body = (await req.json()) as AnyObj;

    // 4) Normalize fields from multiple possible payload shapes
    const event = String(pickFirst(body.event, body.status, "booking_created") ?? "booking_created");

    const external_id = pickFirst(
      body.external_id,
      body.externalId,
      body.booking_id,
      body.bookingId,
      body.booking_id?.toString?.(),
      body["booking-id"]
    );

    const contact_email = normalizeEmail(
      pickFirst(body.contact_email, body.contactEmail, body.email, body.contactEmailAddress)
    );

    const contact_name = String(
      pickFirst(
        body.contact_name,
        body.contactName,
        body.name,
        [body.firstName, body.lastName].filter(Boolean).join(" ").trim()
      ) ?? ""
    ).trim();

    const phone = normalizePhone(pickFirst(body.phone, body.phoneNumber, body.mobile, body.telephone));

    const timezone = String(pickFirst(body.timezone, body.timeZone, body.tz) ?? "").trim() || null;

    // Primary target: start_iso / end_iso
    let start_iso = pickFirst(body.start_iso, body.startIso, body.start_at, body.startAt);
    let end_iso = pickFirst(body.end_iso, body.endIso, body.end_at, body.endAt);

    // If they are unreplaced tokens like "{START_ISO}", treat as missing
    if (looksLikeUnreplacedToken(start_iso)) start_iso = null;
    if (looksLikeUnreplacedToken(end_iso)) end_iso = null;

    // Fallback: local date+time fields (older route format)
    if (!start_iso) {
      start_iso = toIsoFromLocal(body.startDate, body.startTime);
    }
    if (!end_iso) {
      end_iso = toIsoFromLocal(body.endDate, body.endTime);
    }

    const booking_ref = pickFirst(body.booking_ref, body.bookingRef, body.ref, body.reference);
    const booking_page = pickFirst(body.booking_page, body.bookingPage, body.page, body.bookingPageUrl);
    const event_type = pickFirst(body.event_type, body.eventType, body.type, body.booking_title, body.bookingTitle);
    const description = pickFirst(body.description, body.notes, body.note);

    if (!external_id || looksLikeUnreplacedToken(external_id)) {
      statusCode = 400;
      errorMsg = "Missing external_id";
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    if (!start_iso) {
      statusCode = 400;
      errorMsg = "Missing start_iso";
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    // 5) Upsert contact into public.contacts
    // contacts schema: (account_id, name NOT NULL, email, phone, source, source_ref, imported_at, owner_profile_id, last_seen_at)
    const contactNameFinal = contact_name || (contact_email ?? "") || "Unknown";

    let contact_id: string | null = null;

    if (contact_email) {
      const { data: existingContact, error: contactLookupErr } = await supabase
        .from("contacts")
        .select("id")
        .eq("account_id", accountId)
        .ilike("email", contact_email)
        .maybeSingle();

      if (contactLookupErr) {
        statusCode = 500;
        errorMsg = contactLookupErr.message;
        await audit();
        return NextResponse.json({ error: errorMsg }, { status: statusCode });
      }

      if (!existingContact?.id) {
        const { data: inserted, error: insErr } = await supabase
          .from("contacts")
          .insert({
            account_id: accountId,
            name: contactNameFinal,
            email: contact_email,
            phone,
            source: "youcanbookme",
            source_ref: String(external_id),
            imported_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insErr) {
          statusCode = 500;
          errorMsg = insErr.message;
          await audit();
          return NextResponse.json({ error: errorMsg }, { status: statusCode });
        }

        contact_id = inserted.id;
      } else {
        contact_id = existingContact.id;

        const { error: updErr } = await supabase
          .from("contacts")
          .update({
            name: contactNameFinal,
            phone,
            source: "youcanbookme",
            source_ref: String(external_id),
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", contact_id);

        if (updErr) {
          statusCode = 500;
          errorMsg = updErr.message;
          await audit();
          return NextResponse.json({ error: errorMsg }, { status: statusCode });
        }
      }
    }

    // 6) Upsert meeting into public.meetings (external_id unique)
    const meetingStatus =
      event === "booking_cancelled" || event === "booking_canceled" ? "canceled" :
      event === "booking_rescheduled" ? "rescheduled" :
      "scheduled";

    const meetingRow: AnyObj = {
      external_id: String(external_id),
      account_id: accountId,
      contact_email: contact_email,
      contact_name: contactNameFinal,
      scheduled_at: start_iso, // REQUIRED NOT NULL
      status: meetingStatus,
      source: "youcanbookme",

      // extra fields your table already has:
      booked_at: new Date().toISOString(),
      start_at: start_iso,
      end_at: end_iso,
      timezone,
      booking_id: String(external_id),
      booking_ref: booking_ref ? String(booking_ref) : null,
      booking_page: booking_page ? String(booking_page) : null,
      event_type: event_type ? String(event_type) : null,
      email: contact_email,
      phone,
      description: description ? String(description) : null,
      raw: body,
      contact_id,
    };

    const { error: meetErr } = await supabase.from("meetings").upsert(meetingRow, { onConflict: "external_id" });

    if (meetErr) {
      statusCode = 500;
      errorMsg = meetErr.message;
      await audit();
      return NextResponse.json({ error: errorMsg }, { status: statusCode });
    }

    ok = true;
    statusCode = 200;
    errorMsg = null;

    await audit({ ok: true, status_code: 200, error: null });

    return NextResponse.json({
      ok: true,
      account_id: accountId,
      external_id: String(external_id),
      contact_id,
      ms: Date.now() - started,
    });
  } catch (e: any) {
    statusCode = 500;
    errorMsg = e?.message || "Server error";
    await audit();
    return NextResponse.json({ error: errorMsg }, { status: statusCode });
  }
}
