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

    const subject = safeText(body?.subject) || safeText(lead.outreach_subject) || null;
    const draftBody = safeText(body?.body) || safeText(lead.outreach_draft) || null;
    const sentAt = new Date().toISOString();
    const nextSendCount = Number(lead.outreach_send_count || 0) + 1;

    const { error: eventError } = await supabase
      .from("lead_outreach_events")
      .insert({
        account_id: profile.account_id,
        lead_id: id,
        event_type: "sent_manual",
        channel: "email",
        direction: "outbound",
        recipient_email: recipientEmail,
        subject,
        body: draftBody,
        delivery_status: "sent_manual",
        provider: "manual",
        created_by: user.id,
        metadata: {
          note: "Marked sent manually by user",
        },
      });

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("lead_prospects")
      .update({
        preferred_outreach_email: recipientEmail,
        outreach_subject: subject,
        outreach_draft: draftBody,
        outreach_status:
          String(lead.outreach_status || "NOT_CONTACTED").toUpperCase() === "NOT_CONTACTED"
            ? "CONTACTED"
            : lead.outreach_status,
        last_outreach_sent_at: sentAt,
        last_outreach_status: "SENT_MANUAL",
        outreach_send_count: nextSendCount,
        outreach_last_error: null,
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      manual: true,
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/mark-outreach-sent error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}