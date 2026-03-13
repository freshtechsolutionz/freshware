import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Payload = {
  event?: string;
  external_id?: string;
  contact_name?: string;
  contact_email?: string;
  phone?: string | null;

  start_iso?: string;
  end_iso?: string;
  timeZone?: string;

  booking_page?: string;
  event_type?: string;
  description?: string;
  booking_ref?: string;

  meeting_link?: string;
  zoom_link?: string;
  location?: string;

  [k: string]: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function pickMeetingLink(body: Payload): string | null {
  const raw =
    body.meeting_link ||
    body.zoom_link ||
    body.location ||
    (typeof body.raw === "object"
      ? body.raw?.meeting_link ?? body.raw?.zoom_link ?? body.raw?.location
      : null);

  const s = typeof raw === "string" ? raw.trim() : "";
  return s || null;
}

async function ensureOpportunityStub(opts: {
  supabase: any;
  accountId: string;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string;
}) {
  const { supabase, accountId, contactId, contactName, contactEmail } = opts;

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
      name: `${contactName || contactEmail || "New Lead"} - Discovery`,
    })
    .select("id")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data.id as string;
}

export async function POST(req: Request, context: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await context.params;

    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    ) as any;

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

    const secret = req.headers.get("x-ycbm-secret");
    if (!secret || secret !== integration.webhook_secret) {
      return NextResponse.json({ error: "Unauthorized (x-ycbm-secret mismatch)" }, { status: 401 });
    }

    const body = (await req.json()) as Payload;

    const external_id = (body.external_id || "").trim();
    const start_iso = (body.start_iso || "").trim();
    const end_iso = (body.end_iso || "").trim();

    const contact_email = (body.contact_email || "").trim().toLowerCase();
    const contact_name = (body.contact_name || "").trim() || null;

    const description = (body.description || "").trim() || null;
    const phone = (body.phone || "").trim() || null;

    if (!external_id) return NextResponse.json({ error: "Missing external_id" }, { status: 400 });
    if (!start_iso) return NextResponse.json({ error: "Missing start_iso" }, { status: 400 });

    let contact_id: string | null = null;

    if (contact_email) {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("account_id", accountId)
        .ilike("email", contact_email)
        .maybeSingle();

      if (!existingContact?.id) {
        const { data: inserted, error: cErr } = await supabase
          .from("contacts")
          .insert({
            account_id: accountId,
            name: contact_name || contact_email,
            email: contact_email,
            phone,
            source: "youcanbookme",
            source_ref: external_id,
            imported_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        contact_id = inserted.id;
      } else {
        contact_id = existingContact.id;

        await supabase
          .from("contacts")
          .update({
            name: contact_name || contact_email,
            phone,
            source: "youcanbookme",
            source_ref: external_id,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", contact_id);
      }
    }

    const opportunity_id =
      contact_email || contact_id
        ? await ensureOpportunityStub({
            supabase,
            accountId,
            contactId: contact_id,
            contactName: contact_name || null,
            contactEmail: contact_email || "",
          })
        : null;

    const status =
      (body.event || "").toLowerCase() === "booking_cancelled" ? "canceled" : "scheduled";

    const meeting_link = pickMeetingLink(body);

    const { error: mErr } = await supabase
      .from("meetings")
      .upsert(
        {
          external_id,
          account_id: accountId,

          contact_name: contact_name,
          contact_email: contact_email || null,
          scheduled_at: start_iso,
          status,
          source: "youcanbookme",
          description: description,

          booked_at: new Date().toISOString(),
          start_at: start_iso,
          end_at: end_iso || null,
          timezone: body.timeZone || null,
          booking_id: external_id,
          booking_ref: body.booking_ref || null,
          booking_page: body.booking_page || null,
          event_type: body.event_type || null,
          email: contact_email || null,
          phone: phone,
          raw: body,

          contact_id: contact_id,
          opportunity_id: opportunity_id,

          meeting_summary: description,
          meeting_link: meeting_link,
        },
        { onConflict: "external_id" }
      );

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, contact_id, opportunity_id, external_id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}