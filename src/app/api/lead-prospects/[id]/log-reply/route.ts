import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }

  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const message =
      typeof body?.message === "string" ? body.message.trim() : "";
    const senderEmail =
      typeof body?.sender_email === "string" ? body.sender_email.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("lead_prospects")
      .select("id, account_id, company_name, outreach_subject")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    let { data: conversation, error: conversationError } = await supabase
      .from("lead_conversations")
      .select("*")
      .eq("lead_id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 500 });
    }

    if (!conversation) {
      const { data: createdConversation, error: createConversationError } = await supabase
        .from("lead_conversations")
        .insert({
          lead_id: id,
          account_id: profile.account_id,
          subject: lead.outreach_subject || `Conversation with ${lead.company_name || "Lead"}`,
          status: "REPLIED",
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (createConversationError) {
        return NextResponse.json({ error: createConversationError.message }, { status: 500 });
      }

      conversation = createdConversation;
    } else {
      const { error: updateConversationError } = await supabase
        .from("lead_conversations")
        .update({
          status: "REPLIED",
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);

      if (updateConversationError) {
        return NextResponse.json({ error: updateConversationError.message }, { status: 500 });
      }
    }

    const { error: messageError } = await supabase
      .from("lead_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        body: message,
        sender_email: senderEmail || null,
      });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    const { error: leadUpdateError } = await supabase
      .from("lead_prospects")
      .update({
        outreach_status: "RESPONDED",
        last_outreach_status: "REPLIED",
        last_reply_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (leadUpdateError) {
      return NextResponse.json({ error: leadUpdateError.message }, { status: 500 });
    }

    const { error: eventError } = await supabase
      .from("lead_outreach_events")
      .insert({
        account_id: profile.account_id,
        lead_id: id,
        event_type: "reply_logged",
        channel: "email",
        direction: "inbound",
        recipient_email: senderEmail || null,
        subject: lead.outreach_subject || null,
        body: message,
        delivery_status: "replied",
        provider: "manual_log",
        created_by: user.id,
        metadata: {
          source: "manual_reply_log",
        },
      });

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        account_id: profile.account_id,
        user_id: user.id,
        type: "lead_reply",
        message: `${lead.company_name || "A lead"} replied.`,
        link: "/dashboard/lead-generation",
        metadata: {
          lead_id: id,
        },
      });

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/log-reply error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}