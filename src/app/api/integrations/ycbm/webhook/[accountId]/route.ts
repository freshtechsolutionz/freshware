import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Payload = {
  event?: string;

  external_id?: string;
  booking_ref?: string;

  contact_name?: string;
  contact_email?: string;
  phone?: string;

  start_iso?: string;
  end_iso?: string;
  timeZone?: string;

  booking_page?: string;
  event_type?: string;

  description?: string;

  owner_profile_id?: string;

  [k: string]: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function cleanEmail(v?: string | null) {
  const e = (v || "").trim().toLowerCase();
  return e || null;
}

function cleanText(v?: string | null) {
  const s = (v || "").trim();
  return s || null;
}

function safeIso(v?: string | null) {
  const s = (v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function nonNullName(name: string | null, email: string | null) {
  const n = (name || "").trim();
  if (n) return n;
  if (email) return email;
  return "Unknown";
}

function splitName(full: string | null): { first: string | null; last: string | null } {
  const s = (full || "").trim();
  if (!s) return { first: null, last: null };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// YCBM sometimes posts JSON with text/plain
async function readBody(req: Request): Promise<any> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await req.json();
  const raw = await req.text();
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

export async function POST(req: Request, context: { params: Promise<{ accountId: string }> }) {
  const now = new Date().toISOString();

  // We'll use these for audit
  let accountId: string | null = null;
  let body: any = null;
  let statusCode = 200;
  let ok = false;
  let errorMsg: string | null = null;

  // ✅ IMPORTANT: Use an UN-TYPED client for webhook routes to avoid TS "never" issues
  const supabase = createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    const params = await context.params;
    accountId = params.accountId;

    body = (await readBody(req)) as Payload;

    // 1) Integration lookup
    const { data: integration, error: integErr } = await supabase
      .from("account_integrations")
      .select("webhook_secret,status")
      .eq("account_id", accountId)
      .eq("provider", "youcanbookme")
      .maybeSingle();

    if (integErr) {
      statusCode = 500;
      throw new Error(integErr.message);
    }
    if (!integration || integration.status !== "connected") {
      statusCode = 404;
      throw new Error("Integration not connected");
    }

    // 2) Verify secret
    const secret = req.headers.get("x-ycbm-secret");
    if (!secret || secret !== integration.webhook_secret) {
      statusCode = 401;
      throw new Error("Unauthorized (x-ycbm-secret mismatch)");
    }

    // 3) Normalize payload
    const email = cleanEmail((body as any).contact_email);
    const contactName = cleanText((body as any).contact_name);
    const phone = cleanText((body as any).phone);

    const startAt = safeIso((body as any).start_iso);
    const endAt = safeIso((body as any).end_iso);

    const externalId = cleanText((body as any).external_id);
    const bookingRef = cleanText((body as any).booking_ref);

    if (!email) {
      statusCode = 400;
      throw new Error("Missing contact_email");
    }
    if (!startAt) {
      statusCode = 400;
      throw new Error("Missing start_iso");
    }

    const nameForContacts = nonNullName(contactName, email);

    // 4) Upsert contact by (account_id + email)
    const { data: existingContact, error: findErr } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .maybeSingle();

    if (findErr) {
      statusCode = 500;
      throw new Error(findErr.message);
    }

    let contactId: string | null = existingContact?.id ?? null;

    if (!contactId) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          name: nameForContacts,
          email,
          phone,
          source: "youcanbookme",
          source_ref: externalId || bookingRef,
          imported_at: now,
          last_seen_at: now,
          owner_profile_id: (body as any).owner_profile_id || null,
        })
        .select("id")
        .single();

      if (insErr) {
        statusCode = 400;
        throw new Error(insErr.message);
      }
      contactId = inserted.id;
    } else {
      const { error: updErr } = await supabase
        .from("contacts")
        .update({
          name: nameForContacts,
          phone,
          source: "youcanbookme",
          source_ref: externalId || bookingRef,
          last_seen_at: now,
          owner_profile_id: (body as any).owner_profile_id || null,
        })
        .eq("id", contactId);

      if (updErr) {
        statusCode = 400;
        throw new Error(updErr.message);
      }
    }

    // 5) Upsert meeting
    const meetingExternalId = externalId || bookingRef;
    if (!meetingExternalId) {
      statusCode = 400;
      throw new Error("Missing external_id/booking_ref");
    }

    const status =
      (body as any).event === "booking_cancelled"
        ? "canceled"
        : (body as any).event === "booking_rescheduled"
          ? "rescheduled"
          : "scheduled";

    const { first, last } = splitName(contactName);

    const { error: meetingErr } = await supabase
      .from("meetings")
      .upsert(
        {
          external_id: meetingExternalId,
          account_id: accountId,

          contact_email: email,
          contact_name: contactName || nameForContacts,
          scheduled_at: startAt,

          status,
          source: "youcanbookme",

          booked_at: now,
          start_at: startAt,
          end_at: endAt,
          timezone: cleanText((body as any).timeZone),

          booking_id: externalId,
          booking_ref: bookingRef,
          booking_page: cleanText((body as any).booking_page),
          event_type: cleanText((body as any).event_type),

          first_name: first,
          last_name: last,
          email,
          phone,

          description: cleanText((body as any).description),

          raw: body,

          contact_id: contactId,
          owner_profile_id: (body as any).owner_profile_id || null,
        },
        { onConflict: "external_id" }
      );

    if (meetingErr) {
      statusCode = 500;
      throw new Error(meetingErr.message);
    }

    ok = true;
    return NextResponse.json({ ok: true, account_id: accountId, contact_id: contactId, external_id: meetingExternalId });
  } catch (e: any) {
    errorMsg = e?.message || "Server error";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: statusCode || 500 });
  } finally {
    // Audit log (best effort)
    try {
      const headersObj: Record<string, string> = {};
      req.headers.forEach((v, k) => (headersObj[k] = v));

      await supabase.from("webhook_audit").insert({
        source: "youcanbookme",
        account_id: accountId,
        ok,
        status_code: statusCode,
        error: errorMsg,
        headers: headersObj,
        body,
      });
    } catch {
      // ignore
    }
  }
}
