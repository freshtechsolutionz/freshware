import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function parseJsonFromResponse(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}

async function generateWithOpenAI(input: {
  company_name: string;
  detected_need: string | null;
  recommended_service_line: string | null;
  ai_summary: string | null;
  outreach_angle: string | null;
  contact_name: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_LEAD_GEN_MODEL || "gpt-5-mini";

  const prompt = `
You are writing a short B2B outreach email for a software and digital transformation agency.

Return STRICT JSON only:
{
  "subject": "string",
  "body": "string"
}

Requirements:
- concise
- warm and credible
- not pushy
- no emojis
- sound like a CEO-level outreach message
- connect to the lead's likely need
- ask for a quick conversation
- body should be plain text, 80 to 140 words

Lead:
${JSON.stringify(input, null, 2)}
  `.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data) return null;

  const text = parseJsonFromResponse(data);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fallbackOutreach(lead: any) {
  const company = lead.company_name || "your company";
  const need = lead.detected_need || "a stronger digital growth strategy";
  const service = lead.recommended_service_line || "technology support";

  return {
    subject: `Quick idea for ${company}`,
    body: `Hi,

I came across ${company} and noticed what looks like an opportunity around ${need.toLowerCase()}. My team helps businesses improve growth, efficiency, and customer experience through practical ${service} solutions without making the process overly complicated.

Based on what I saw, I think there may be a few quick wins worth discussing. Would you be open to a short conversation to see whether there is a fit?

Best,
Derrell`,
  };
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

    const { data: lead, error: leadError } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const ai =
      (await generateWithOpenAI({
        company_name: lead.company_name || "",
        detected_need: lead.detected_need || null,
        recommended_service_line: lead.recommended_service_line || null,
        ai_summary: lead.ai_summary || null,
        outreach_angle: lead.outreach_angle || null,
        contact_name: lead.contact_name || null,
      })) || fallbackOutreach(lead);

    const patch = {
      outreach_subject: ai.subject || null,
      outreach_draft: ai.body || null,
      outreach_last_generated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("lead_prospects")
      .update(patch)
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      subject: patch.outreach_subject,
      body: patch.outreach_draft,
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/generate-outreach error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}