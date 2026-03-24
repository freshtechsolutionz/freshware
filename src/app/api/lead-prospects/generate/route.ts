import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

type CompanyRow = Record<string, any>;

type LeadProspect = {
  company_name: string;
  website: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industry: string | null;
  company_size: string | null;
  source: string | null;
  source_url: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  detected_need: string | null;
  recommended_service_line: string | null;
  fit_score: number | null;
  need_score: number | null;
  urgency_score: number | null;
  access_score: number | null;
  total_score: number | null;
  ai_summary: string | null;
  ai_reasoning: string | null;
  outreach_angle: string | null;
  first_touch_message: string | null;
};

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeNullableText(value: unknown): string | null {
  const v = safeText(value);
  return v || null;
}

function safeScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function jsonFromResponsePayload(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputs = Array.isArray(data?.output) ? data.output : [];
  const textParts: string[] = [];

  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function normalizeLead(raw: any): LeadProspect | null {
  const companyName = safeText(raw?.company_name || raw?.companyName);
  if (!companyName) return null;

  return {
    company_name: companyName,
    website: safeNullableText(raw?.website),
    linkedin_url: safeNullableText(raw?.linkedin_url || raw?.linkedinUrl),
    city: safeNullableText(raw?.city),
    state: safeNullableText(raw?.state),
    country: safeNullableText(raw?.country),
    industry: safeNullableText(raw?.industry),
    company_size: safeNullableText(raw?.company_size || raw?.companySize),
    source: safeNullableText(raw?.source) || "manual_ai_generation",
    source_url: safeNullableText(raw?.source_url || raw?.sourceUrl),
    contact_name: safeNullableText(raw?.contact_name || raw?.contactName),
    contact_title: safeNullableText(raw?.contact_title || raw?.contactTitle),
    contact_email: safeNullableText(raw?.contact_email || raw?.contactEmail),
    contact_phone: safeNullableText(raw?.contact_phone || raw?.contactPhone),
    detected_need: safeNullableText(raw?.detected_need || raw?.detectedNeed),
    recommended_service_line: safeNullableText(raw?.recommended_service_line || raw?.recommendedServiceLine),
    fit_score: safeScore(raw?.fit_score || raw?.fitScore),
    need_score: safeScore(raw?.need_score || raw?.needScore),
    urgency_score: safeScore(raw?.urgency_score || raw?.urgencyScore),
    access_score: safeScore(raw?.access_score || raw?.accessScore),
    total_score: safeScore(raw?.total_score || raw?.totalScore),
    ai_summary: safeNullableText(raw?.ai_summary || raw?.aiSummary),
    ai_reasoning: safeNullableText(raw?.ai_reasoning || raw?.aiReasoning),
    outreach_angle: safeNullableText(raw?.outreach_angle || raw?.outreachAngle),
    first_touch_message: safeNullableText(raw?.first_touch_message || raw?.firstTouchMessage),
  };
}

function fallbackParseCandidates(candidateInput: string, serviceFocus: string): LeadProspect[] {
  const lines = candidateInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);

  const leads: LeadProspect[] = [];

  for (const line of lines) {
    const parts = line.split(/[|,-]{1,2}/).map((p) => p.trim()).filter(Boolean);
    const first = parts[0] || line;

    leads.push({
      company_name: first,
      website: null,
      linkedin_url: null,
      city: null,
      state: null,
      country: null,
      industry: null,
      company_size: null,
      source: "manual_fallback_parse",
      source_url: null,
      contact_name: null,
      contact_title: null,
      contact_email: null,
      contact_phone: null,
      detected_need: serviceFocus || "Needs qualification",
      recommended_service_line: serviceFocus || null,
      fit_score: 50,
      need_score: 50,
      urgency_score: 35,
      access_score: 25,
      total_score: 40,
      ai_summary: "Parsed from manual candidate input. Needs deeper qualification.",
      ai_reasoning: "Fallback parsing was used because AI parsing was unavailable.",
      outreach_angle: serviceFocus
        ? `Lead with a ${serviceFocus} discovery conversation tied to business outcomes.`
        : "Lead with discovery and qualification.",
      first_touch_message: null,
    });
  }

  return leads;
}

async function generateWithOpenAI(args: {
  mode: string;
  serviceFocus: string;
  geography: string;
  industries: string;
  companySizes: string;
  buyerTitles: string;
  notes: string;
  candidateInput: string;
  lookalikeCompany: CompanyRow | null;
}): Promise<LeadProspect[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_LEAD_GENERATION_MODEL || "gpt-5-mini";

  const prompt = `
You are an elite B2B lead scoring strategist for Fresh Tech Solutionz.

Goal:
Parse the candidate company input and turn it into structured lead prospects for a CRM.

Rules:
- Use ONLY the candidate input and the optional lookalike company context provided below.
- Do NOT invent fake companies that are not present in candidate input.
- If a field is not present or cannot be reasonably inferred, return null.
- You MAY infer likely service need and recommended service line using business signals in the candidate input.
- Score each lead from 0 to 100 for:
  - fit_score
  - need_score
  - urgency_score
  - access_score
  - total_score
- total_score should reflect overall quality for Fresh Tech Solutionz.
- Recommended service line should usually be one of:
  website
  mobile_app
  software
  ai
  support
  consulting
- first_touch_message should be concise and usable.

Return STRICT JSON only in this exact shape:
{
  "leads": [
    {
      "company_name": "string",
      "website": "string or null",
      "linkedin_url": "string or null",
      "city": "string or null",
      "state": "string or null",
      "country": "string or null",
      "industry": "string or null",
      "company_size": "string or null",
      "source": "string or null",
      "source_url": "string or null",
      "contact_name": "string or null",
      "contact_title": "string or null",
      "contact_email": "string or null",
      "contact_phone": "string or null",
      "detected_need": "string or null",
      "recommended_service_line": "string or null",
      "fit_score": 0,
      "need_score": 0,
      "urgency_score": 0,
      "access_score": 0,
      "total_score": 0,
      "ai_summary": "string or null",
      "ai_reasoning": "string or null",
      "outreach_angle": "string or null",
      "first_touch_message": "string or null"
    }
  ]
}

Lead generation settings:
${JSON.stringify(
  {
    mode: args.mode,
    serviceFocus: args.serviceFocus,
    geography: args.geography,
    industries: args.industries,
    companySizes: args.companySizes,
    buyerTitles: args.buyerTitles,
    notes: args.notes,
    lookalikeCompany: args.lookalikeCompany,
  },
  null,
  2
)}

Candidate input:
${args.candidateInput}
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

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = jsonFromResponsePayload(data);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const leads = Array.isArray(parsed?.leads) ? parsed.leads : [];
    return leads.map(normalizeLead).filter(Boolean) as LeadProspect[];
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));

    const mode = safeText(body?.mode) || "icp";
    const serviceFocus = safeText(body?.serviceFocus);
    const geography = safeText(body?.geography);
    const industries = safeText(body?.industries);
    const companySizes = safeText(body?.companySizes);
    const buyerTitles = safeText(body?.buyerTitles);
    const notes = safeText(body?.notes);
    const candidateInput = safeText(body?.candidateInput);
    const lookalikeCompanyId = safeText(body?.lookalikeCompanyId);

    if (!candidateInput) {
      return NextResponse.json(
        { error: "Paste candidate companies, websites, directory rows, or CSV-like text first." },
        { status: 400 }
      );
    }

    let lookalikeCompany: CompanyRow | null = null;

    if (lookalikeCompanyId) {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", lookalikeCompanyId)
        .eq("account_id", profile.account_id)
        .maybeSingle();

      lookalikeCompany = data || null;
    }

    let leads =
      (await generateWithOpenAI({
        mode,
        serviceFocus,
        geography,
        industries,
        companySizes,
        buyerTitles,
        notes,
        candidateInput,
        lookalikeCompany,
      })) || fallbackParseCandidates(candidateInput, serviceFocus);

    if (!leads.length) {
      return NextResponse.json({ error: "No lead prospects could be parsed from your input." }, { status: 400 });
    }

    leads = leads.slice(0, 100);

    const rows = leads.map((lead) => ({
      account_id: profile.account_id,
      company_name: lead.company_name,
      website: lead.website,
      linkedin_url: lead.linkedin_url,
      city: lead.city,
      state: lead.state,
      country: lead.country,
      industry: lead.industry,
      company_size: lead.company_size,
      source: lead.source,
      source_url: lead.source_url,
      contact_name: lead.contact_name,
      contact_title: lead.contact_title,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      detected_need: lead.detected_need,
      recommended_service_line: lead.recommended_service_line,
      fit_score: lead.fit_score,
      need_score: lead.need_score,
      urgency_score: lead.urgency_score,
      access_score: lead.access_score,
      total_score: lead.total_score,
      ai_summary: lead.ai_summary,
      ai_reasoning: lead.ai_reasoning,
      outreach_angle: lead.outreach_angle,
      first_touch_message: lead.first_touch_message,
      status: "new",
      generation_mode: mode,
      criteria_snapshot: {
        mode,
        serviceFocus,
        geography,
        industries,
        companySizes,
        buyerTitles,
        notes,
      },
      lookalike_company_id: lookalikeCompanyId || null,
      created_by: user.id,
    }));

    const { data: inserted, error } = await supabase
      .from("lead_prospects")
      .insert(rows)
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        count: inserted?.length || 0,
        leads: inserted || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/lead-prospects/generate error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}