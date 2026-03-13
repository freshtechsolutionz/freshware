import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WEBHOOK_SECRET = process.env.FRESHWARE_WEBHOOK_SECRET || "";

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function ensureContact(opts: {
  supabase: ReturnType<typeof supabaseAdmin>;
  accountId: string;
  email: string;
  name: string | null;
  phone?: string | null;
  sourceRef?: string | null;
}) {
  const { supabase, accountId, email, name, phone, sourceRef } = opts;

  const existing = await supabase
    .from("contacts")
    .select("id, name")
    .eq("account_id", accountId)
    .ilike("email", email)
    .maybeSingle();

  if (existing.data?.id) {
    await supabase
      .from("contacts")
      .update({
        name: name || existing.data.name || email,
        phone: phone || null,
        source: "email_summary",
        source_ref: sourceRef || null,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);

    return existing.data.id as string;
  }

  const inserted = await supabase
    .from("contacts")
    .insert({
      account_id: accountId,
      name: name || email,
      email,
      phone: phone || null,
      source: "email_summary",
      source_ref: sourceRef || null,
      imported_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data.id as string;
}

async function ensureOpportunityStub(opts: {
  supabase: ReturnType<typeof supabaseAdmin>;
  accountId: string;
  contactId: string | null;
  externalId: string;
  contactName: string | null;
  contactEmail: string;
  summary: string;
}) {
  const { supabase, accountId, contactId, externalId, contactName, contactEmail, summary } = opts;

  if (contactId) {
    const existing = await supabase
      .from("opportunities")
      .select("id, stage")
      .eq("account_id", accountId)
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .neq("stage", "won")
      .neq("stage", "lost")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data?.id) return existing.data.id as string;
  }

  const nameBase = contactName || contactEmail || "New Lead";
  const stubName = `${nameBase} - Discovery`;

  const inserted = await supabase
    .from("opportunities")
    .insert({
      account_id: accountId,
      contact_id: contactId,
      owner_user_id: null,
      service_line: "consultations",
      stage: "new",
      amount: 0,
      probability: null,
      last_activity_at: new Date().toISOString(),
      name: stubName,
    })
    .select("id")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);

  return inserted.data.id as string;
}

async function createMeetingStub(opts: {
  supabase: ReturnType<typeof supabaseAdmin>;
  accountId: string;
  contactId: string | null;
  contactEmail: string;
  contactName: string | null;
  opportunityId: string | null;
  externalId: string;
  summary: string;
  notes: string;
  meetingLink: string;
  raw?: any;
}) {
  const {
    supabase,
    accountId,
    contactId,
    contactEmail,
    contactName,
    opportunityId,
    externalId,
    summary,
    notes,
    meetingLink,
    raw,
  } = opts;

  const nowIso = new Date().toISOString();

  const inserted = await supabase
    .from("meetings")
    .insert({
      account_id: accountId,
      external_id: externalId || null,
      contact_email: contactEmail || null,
      contact_name: contactName || contactEmail,
      scheduled_at: nowIso,
      status: "scheduled",
      source: "email_summary_stub",
      description: summary || notes || null,
      booked_at: nowIso,
      start_at: nowIso,
      end_at: null,
      timezone: null,
      booking_id: externalId || null,
      booking_ref: null,
      booking_page: null,
      event_type: "email_summary_stub",
      email: contactEmail || null,
      phone: null,
      raw: raw && typeof raw === "object" ? raw : null,
      contact_id: contactId,
      opportunity_id: opportunityId,
      meeting_summary: summary || null,
      notes: notes || null,
      meeting_link: meetingLink || null,
      meeting_summary_received_at: nowIso,
    })
    .select("id")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data.id as string;
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "email-summary" }, { status: 200 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await context.params;

    const providedSecret =
      req.headers.get("x-freshware-secret") ||
      req.headers.get("X-Freshware-Secret") ||
      "";

    if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const external_id =
      typeof (body as any).external_id === "string" ? (body as any).external_id.trim() : "";

    const contact_email =
      typeof (body as any).contact_email === "string"
        ? (body as any).contact_email.trim().toLowerCase()
        : "";

    const contact_name =
      typeof (body as any).contact_name === "string"
        ? (body as any).contact_name.trim()
        : "";

    const summary =
      typeof (body as any).summary === "string" ? (body as any).summary.trim() : "";

    const meeting_link =
      typeof (body as any).meeting_link === "string" ? (body as any).meeting_link.trim() : "";

    const notes =
      typeof (body as any).notes === "string" ? (body as any).notes.trim() : "";

    const raw = (body as any).raw;

    if (!accountId) {
      return NextResponse.json({ ok: false, error: "Missing accountId in route" }, { status: 400 });
    }

    if (!external_id && !contact_email) {
      return NextResponse.json(
        { ok: false, error: "Provide external_id or contact_email" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      meeting_summary: summary || null,
      meeting_link: meeting_link || null,
      notes: notes || null,
      meeting_summary_received_at: new Date().toISOString(),
    };

    if (raw && typeof raw === "object") updatePayload.raw = raw;

    const supabase = supabaseAdmin();

    // 1) Try direct external_id match
    if (external_id) {
      const directLookup = await supabase
        .from("meetings")
        .select("id, contact_id, opportunity_id, contact_email, contact_name")
        .eq("account_id", accountId)
        .eq("external_id", external_id)
        .maybeSingle();

      if (directLookup.error) {
        return NextResponse.json({ ok: false, error: directLookup.error.message }, { status: 500 });
      }

      if (directLookup.data?.id) {
        const patched = await supabase
          .from("meetings")
          .update(updatePayload)
          .eq("id", directLookup.data.id)
          .select("id")
          .single();

        if (patched.error) {
          return NextResponse.json({ ok: false, error: patched.error.message }, { status: 500 });
        }

        return NextResponse.json(
          { ok: true, updated: true, meeting_id: patched.data.id, matched_by: "external_id" },
          { status: 200 }
        );
      }
    }

    // 2) Try recent contact_email match
    if (contact_email) {
      const daysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const lookup = await supabase
        .from("meetings")
        .select("id, external_id, scheduled_at, created_at, contact_id, opportunity_id")
        .eq("account_id", accountId)
        .eq("contact_email", contact_email)
        .gte("created_at", daysAgo)
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookup.error) {
        return NextResponse.json({ ok: false, error: lookup.error.message }, { status: 500 });
      }

      if (lookup.data?.id) {
        const patched = await supabase
          .from("meetings")
          .update(updatePayload)
          .eq("id", lookup.data.id)
          .select("id")
          .single();

        if (patched.error) {
          return NextResponse.json({ ok: false, error: patched.error.message }, { status: 500 });
        }

        return NextResponse.json(
          {
            ok: true,
            updated: true,
            meeting_id: patched.data.id,
            matched_by: "contact_email",
            contact_email,
          },
          { status: 200 }
        );
      }
    }

    // 3) No match found → auto-create contact + opportunity + meeting stub
    if (!contact_email) {
      return NextResponse.json(
        { ok: false, error: "Unable to auto-create without contact_email" },
        { status: 400 }
      );
    }

    const contactId = await ensureContact({
      supabase,
      accountId,
      email: contact_email,
      name: contact_name || null,
      phone: null,
      sourceRef: external_id || null,
    });

    const opportunityId = await ensureOpportunityStub({
      supabase,
      accountId,
      contactId,
      externalId: external_id || "",
      contactName: contact_name || null,
      contactEmail: contact_email,
      summary,
    });

    const meetingId = await createMeetingStub({
      supabase,
      accountId,
      contactId,
      contactEmail: contact_email,
      contactName: contact_name || null,
      opportunityId,
      externalId: external_id || "",
      summary,
      notes,
      meetingLink: meeting_link,
      raw,
    });

    return NextResponse.json(
      {
        ok: true,
        auto_created: true,
        matched_by: "auto_create",
        contact_email,
        contact_id: contactId,
        opportunity_id: opportunityId,
        meeting_id: meetingId,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}