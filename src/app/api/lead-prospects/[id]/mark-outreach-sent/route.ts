import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(raw: string | null | undefined) {
  const value = safeText(raw).toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function buildFallbackSubject(companyName: string | null | undefined) {
  return `Quick idea for ${companyName || "your company"}`;
}

function buildFallbackBody(lead: any) {
  const company = lead.company_name || "your company";
  const need = lead.detected_need || "a stronger digital growth strategy";
  const service = lead.recommended_service_line || "technology support";

  return `Hi,

I came across ${company} and noticed what looks like an opportunity around ${String(need).toLowerCase()}. My team helps businesses improve growth, efficiency, and customer experience through practical ${service} solutions without making the process overly complicated.

Based on what I saw, I think there may be a few quick wins worth discussing. Would you be open to a short conversation to see whether there is a fit?

Best,
Derrell`;
}

function buildMailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function insertEvent(supabase: any, payload: Record<string, any>) {
  await supabase.from("lead_outreach_events").insert(payload);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const { data: lead, error: leadError } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const discoveredEmails = toArray(lead.discovered_emails);
    const recipientEmail =
      normalizeEmail(body?.recipient_email) ||
      normalizeEmail(lead.preferred_outreach_email) ||
      normalizeEmail(lead.contact_email) ||
      normalizeEmail(discoveredEmails[0]) ||
      null;

    if (!recipientEmail) {
      return NextResponse.json({ error: "No valid recipient email found for this lead." }, { status: 400 });
    }

    const subject =
      safeText(body?.subject) ||
      safeText(lead.outreach_subject) ||
      buildFallbackSubject(lead.company_name);

    const draftBody =
      safeText(body?.body) ||
      safeText(lead.outreach_draft) ||
      safeText(lead.first_touch_message) ||
      buildFallbackBody(lead);

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.OUTREACH_FROM_EMAIL;

    await supabase
      .from("lead_prospects")
      .update({
        preferred_outreach_email: recipientEmail,
        outreach_subject: subject,
        outreach_draft: draftBody,
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (!resendApiKey || !fromEmail) {
      const mailtoUrl = buildMailtoUrl(recipientEmail, subject, draftBody);

      await insertEvent(supabase, {
        account_id: profile.account_id,
        lead_id: id,
        event_type: "manual_send_required",
        channel: "email",
        direction: "outbound",
        recipient_email: recipientEmail,
        subject,
        body: draftBody,
        delivery_status: "manual_send_required",
        provider: "mailto",
        created_by: user.id,
        metadata: {
          reason: "Missing RESEND_API_KEY or OUTREACH_FROM_EMAIL",
        },
      });

      await supabase
        .from("lead_prospects")
        .update({
          preferred_outreach_email: recipientEmail,
          last_outreach_status: "MANUAL_SEND_REQUIRED",
          outreach_last_error: "Missing RESEND_API_KEY or OUTREACH_FROM_EMAIL",
        })
        .eq("id", id)
        .eq("account_id", profile.account_id);

      return NextResponse.json({
        ok: true,
        manual_required: true,
        recipient_email: recipientEmail,
        subject,
        body: draftBody,
        mailto_url: mailtoUrl,
      });
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject,
        text: draftBody,
      }),
    });

    const resendJson = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      const errorMessage =
        resendJson?.message ||
        resendJson?.error ||
        "Failed to send email";

      await insertEvent(supabase, {
        account_id: profile.account_id,
        lead_id: id,
        event_type: "send_failed",
        channel: "email",
        direction: "outbound",
        recipient_email: recipientEmail,
        subject,
        body: draftBody,
        delivery_status: "failed",
        provider: "resend",
        created_by: user.id,
        metadata: resendJson || {},
      });

      await supabase
        .from("lead_prospects")
        .update({
          preferred_outreach_email: recipientEmail,
          last_outreach_status: "FAILED",
          outreach_last_error: errorMessage,
        })
        .eq("id", id)
        .eq("account_id", profile.account_id);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const providerMessageId = resendJson?.id || null;
    const nextSendCount = Number(lead.outreach_send_count || 0) + 1;
    const sentAt = new Date().toISOString();

    await insertEvent(supabase, {
      account_id: profile.account_id,
      lead_id: id,
      event_type: "sent",
      channel: "email",
      direction: "outbound",
      recipient_email: recipientEmail,
      subject,
      body: draftBody,
      delivery_status: "sent",
      provider: "resend",
      provider_message_id: providerMessageId,
      created_by: user.id,
      metadata: resendJson || {},
    });

    await supabase
      .from("lead_prospects")
      .update({
        preferred_outreach_email: recipientEmail,
        outreach_subject: subject,
        outreach_draft: draftBody,
        outreach_last_generated_at: new Date().toISOString(),
        outreach_status:
          String(lead.outreach_status || "NOT_CONTACTED").toUpperCase() === "NOT_CONTACTED"
            ? "CONTACTED"
            : lead.outreach_status,
        last_outreach_sent_at: sentAt,
        last_outreach_status: "SENT",
        outreach_send_count: nextSendCount,
        outreach_last_error: null,
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    return NextResponse.json({
      ok: true,
      sent: true,
      recipient_email: recipientEmail,
      subject,
      provider: "resend",
      provider_message_id: providerMessageId,
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/send-outreach error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}