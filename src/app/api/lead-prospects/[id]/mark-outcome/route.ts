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

    const outcome =
      typeof body?.outcome === "string" ? body.outcome.trim().toUpperCase() : "";
    const notes =
      typeof body?.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;

    if (!["WON", "LOST", "NO_RESPONSE", "OPEN"].includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from("lead_prospects")
      .select("id, company_name")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("lead_prospects")
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
        source_feedback_notes: notes,
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        account_id: profile.account_id,
        user_id: user.id,
        type: "lead_outcome",
        message: `${lead.company_name || "Lead"} marked ${outcome}.`,
        link: "/dashboard/lead-generation",
        metadata: {
          lead_id: id,
          outcome,
        },
      });

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/mark-outcome error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}