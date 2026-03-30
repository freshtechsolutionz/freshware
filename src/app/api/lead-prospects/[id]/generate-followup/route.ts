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

export async function POST(
  _req: Request,
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

    const { data: lead, error } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const company = safeText(lead.company_name) || "your company";
    const need = safeText(lead.detected_need) || "improving growth and efficiency";
    const service = safeText(lead.recommended_service_line) || "technology support";

    const subject = `Following up on ${company}`;
    const body = `Hi,

I wanted to follow up on my earlier message regarding ${need.toLowerCase()}.

Based on what I saw, there may be a practical opportunity to help ${company} through ${service} in a way that improves execution without overcomplicating things.

Would you be open to a quick conversation sometime this week to see whether there is a fit?

Best,
Derrell`;

    const { error: updateError } = await supabase
      .from("lead_prospects")
      .update({
        outreach_subject: subject,
        outreach_draft: body,
        outreach_last_generated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      subject,
      body,
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/generate-followup error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}