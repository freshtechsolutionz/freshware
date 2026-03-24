import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

type CompanyRow = Record<string, any>;
type ContactRow = Record<string, any>;
type OpportunityRow = Record<string, any>;
type ProjectRow = Record<string, any>;

type AICompanyInfo = {
  executiveSummary: string;
  marketPositioning: string;
  likelyNeeds: string[];
  salesAngles: string[];
  risks: string[];
  recommendedNextSteps: string[];
};

type EnrichmentResponse = {
  ai_company_info: AICompanyInfo;
  profile_updates: Record<string, string | null>;
};

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWebsite(url: string | null | undefined): string | null {
  const raw = safeText(url);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWebsiteText(website: string | null | undefined): Promise<string> {
  const normalized = normalizeWebsite(website);
  if (!normalized) return "";

  try {
    const res = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "FreshwareCompanyEnrichmentBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!res.ok) return "";
    const html = await res.text();
    const text = stripHtml(html);
    return text.slice(0, 12000);
  } catch {
    return "";
  }
}

function splitToList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/\r?\n|•|;|,/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function compact<T>(values: Array<T | null | undefined | false | "">): T[] {
  return values.filter(Boolean) as T[];
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

function cleanAIInfo(raw: any): AICompanyInfo {
  return {
    executiveSummary: safeText(raw?.executiveSummary),
    marketPositioning: safeText(raw?.marketPositioning),
    likelyNeeds: uniq(Array.isArray(raw?.likelyNeeds) ? raw.likelyNeeds.map((v: any) => safeText(v)) : []),
    salesAngles: uniq(Array.isArray(raw?.salesAngles) ? raw.salesAngles.map((v: any) => safeText(v)) : []),
    risks: uniq(Array.isArray(raw?.risks) ? raw.risks.map((v: any) => safeText(v)) : []),
    recommendedNextSteps: uniq(
      Array.isArray(raw?.recommendedNextSteps) ? raw.recommendedNextSteps.map((v: any) => safeText(v)) : []
    ),
  };
}

const ALLOWED_PROFILE_FIELDS = [
  "name",
  "legal_name",
  "website",
  "linkedin_url",
  "email",
  "phone",
  "mailing_address",
  "city",
  "state",
  "postal_code",
  "country",
  "preferred_contact_method",
  "primary_contact_name",
  "primary_contact_role",
  "primary_contact_email",
  "primary_contact_phone",
  "industry",
  "industry_code",
  "company_size",
  "employee_count_range",
  "revenue_band",
  "headquarters_location",
  "legal_entity",
  "tax_id",
  "business_model",
  "ownership_type",
  "key_decision_makers",
  "org_chart_notes",
  "contracting_billing_preferences",
  "company_age",
  "organizational_structure",
  "revenue_level",
  "core_competencies",
  "facilities_summary",
  "top_three_customers",
  "initial_engagement_source",
  "relationship_summary",
  "product_service_usage_frequency",
  "feature_usage_details",
  "channel_preferences",
  "engagement_history",
  "website_behavior",
  "support_interactions",
  "trial_onboarding_progress",
  "renewal_churn_signals",
  "purchase_frequency",
  "payment_terms_history",
  "outstanding_invoices",
  "discounts_pricing",
  "primary_software_platforms",
  "hardware_equipment",
  "integration_points",
  "it_decision_maker",
  "security_compliance_requirements",
  "customer_kpis",
  "baseline_kpis",
  "target_kpis",
  "operational_cadence",
  "primary_business_goals",
  "top_pain_points",
  "buying_motivations",
  "risk_tolerance",
  "values_culture_signals",
  "jobs_to_be_done",
  "current_workarounds",
  "solution_triggers",
  "consequences_of_failure",
  "problem_frequency_severity",
  "buying_committee",
  "approval_thresholds",
  "procurement_steps",
  "preferred_vendors_rules",
  "objections_negotiation_levers",
  "internal_account_owner",
  "onboarding_notes",
  "support_ticket_history",
  "sla_commitments_breaches",
  "csat_nps",
  "renewal_conversations",
  "contract_clauses_of_note",
  "regulatory_constraints",
  "insurance_requirements",
  "privacy_constraints",
  "export_controls_flags",
  "customer_segment",
  "lifecycle_stage",
  "priority_level",
  "custom_tags",
  "interview_transcripts_quotes",
  "case_studies",
  "feedback_feature_requests",
] as const;

const NUMBER_FIELDS = ["procurement_cycle_days", "clv_estimate", "average_order_value"] as const;
const DATE_FIELDS = ["last_purchase_date", "contract_start_date", "contract_end_date"] as const;

function buildFallbackEnrichment(
  company: CompanyRow,
  contacts: ContactRow[],
  opportunities: OpportunityRow[],
  projects: ProjectRow[],
  websiteText: string
): EnrichmentResponse {
  const serviceLines = uniq(
    opportunities.map((o) => safeText(o.service_line)).filter(Boolean)
  );
  const leadership = contacts
    .filter((c) => /(ceo|founder|owner|president|director|vp|head|manager)/i.test(String(c.title || "")))
    .map((c) => `${c.name || "Unknown"}${c.title ? ` - ${c.title}` : ""}`);

  const websiteSnippet = websiteText.slice(0, 500);
  const likelyNeeds = compact<string>([
    company.top_pain_points ? `Address ${company.top_pain_points}` : null,
    serviceLines[0] ? `Potential fit for ${serviceLines[0]}` : null,
    company.primary_software_platforms ? "Systems integration and workflow optimization" : null,
    projects.length ? "Delivery visibility and account expansion support" : null,
  ]);

  return {
    ai_company_info: {
      executiveSummary: company.name
        ? `${company.name} appears to be a ${safeText(company.industry) || "business"} account with opportunity for stronger positioning, qualification, and account intelligence.`
        : "This company profile needs enrichment and clearer strategic positioning.",
      marketPositioning:
        company.primary_business_goals
          ? `Best positioned around business outcomes tied to ${company.primary_business_goals}.`
          : "Best positioned around business outcomes, process clarity, and scalable execution.",
      likelyNeeds,
      salesAngles: compact<string>([
        company.buying_motivations ? `Lead with ${company.buying_motivations}` : null,
        serviceLines[0] ? `Position ${serviceLines[0]} as outcome-driven` : null,
        websiteSnippet ? "Use the public website to sharpen the offer and messaging" : null,
      ]),
      risks: compact<string>([
        !company.industry ? "Industry not documented" : null,
        !company.top_pain_points ? "Pain points not documented" : null,
        !leadership.length ? "Decision-maker visibility is weak" : null,
      ]),
      recommendedNextSteps: compact<string>([
        "Review enriched fields and correct anything inaccurate",
        !company.primary_contact_name ? "Confirm the primary contact" : null,
        !company.top_pain_points ? "Document ranked pain points" : null,
        !company.primary_business_goals ? "Document primary business goals" : null,
      ]),
    },
    profile_updates: {
      relationship_summary:
        safeText(company.relationship_summary) ||
        (websiteSnippet ? `Public website context captured for enrichment. ${websiteSnippet}` : null),
      key_decision_makers:
        safeText(company.key_decision_makers) || (leadership.length ? leadership.join("\n") : null),
      top_pain_points: safeText(company.top_pain_points) || (likelyNeeds[0] || null),
      primary_business_goals: safeText(company.primary_business_goals) || (serviceLines[0] ? `Improve results through ${serviceLines[0]}` : null),
    },
  };
}

async function generateWithOpenAI(input: {
  company: CompanyRow;
  contacts: ContactRow[];
  opportunities: OpportunityRow[];
  projects: ProjectRow[];
  websiteText: string;
}): Promise<EnrichmentResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_COMPANY_ENRICH_MODEL || "gpt-5-mini";

  const prompt = `
You are enriching a B2B company profile inside a CRM.

Goal:
1. Generate AI summary intelligence
2. Fill in as many missing company profile fields as possible using ONLY the supplied CRM data and public website text
3. Do NOT invent precise facts that are not supported
4. When uncertain, leave a field as null
5. Prefer concise, usable business language
6. If a field already appears to have a meaningful value, you may still improve it only if the new version is clearly better and supported

Return STRICT JSON only in this exact shape:
{
  "ai_company_info": {
    "executiveSummary": "string",
    "marketPositioning": "string",
    "likelyNeeds": ["string"],
    "salesAngles": ["string"],
    "risks": ["string"],
    "recommendedNextSteps": ["string"]
  },
  "profile_updates": {
    "industry": "string or null",
    "company_size": "string or null",
    "employee_count_range": "string or null",
    "revenue_band": "string or null",
    "headquarters_location": "string or null",
    "business_model": "string or null",
    "ownership_type": "string or null",
    "key_decision_makers": "string or null",
    "org_chart_notes": "string or null",
    "company_age": "string or null",
    "organizational_structure": "string or null",
    "revenue_level": "string or null",
    "core_competencies": "string or null",
    "top_three_customers": "string or null",
    "initial_engagement_source": "string or null",
    "relationship_summary": "string or null",
    "product_service_usage_frequency": "string or null",
    "feature_usage_details": "string or null",
    "channel_preferences": "string or null",
    "engagement_history": "string or null",
    "website_behavior": "string or null",
    "support_interactions": "string or null",
    "renewal_churn_signals": "string or null",
    "primary_software_platforms": "string or null",
    "hardware_equipment": "string or null",
    "integration_points": "string or null",
    "it_decision_maker": "string or null",
    "security_compliance_requirements": "string or null",
    "customer_kpis": "string or null",
    "baseline_kpis": "string or null",
    "target_kpis": "string or null",
    "operational_cadence": "string or null",
    "primary_business_goals": "string or null",
    "top_pain_points": "string or null",
    "buying_motivations": "string or null",
    "risk_tolerance": "string or null",
    "values_culture_signals": "string or null",
    "jobs_to_be_done": "string or null",
    "current_workarounds": "string or null",
    "solution_triggers": "string or null",
    "consequences_of_failure": "string or null",
    "problem_frequency_severity": "string or null",
    "buying_committee": "string or null",
    "approval_thresholds": "string or null",
    "procurement_steps": "string or null",
    "preferred_vendors_rules": "string or null",
    "objections_negotiation_levers": "string or null",
    "customer_segment": "string or null",
    "lifecycle_stage": "string or null",
    "priority_level": "string or null",
    "custom_tags": "string or null",
    "case_studies": "string or null",
    "feedback_feature_requests": "string or null"
  }
}

CRM DATA:
${JSON.stringify(
  {
    company: input.company,
    contacts: input.contacts,
    opportunities: input.opportunities,
    projects: input.projects,
    websiteText: input.websiteText,
  },
  null,
  2
)}
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
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text = parseJsonFromResponse(data);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return {
      ai_company_info: cleanAIInfo(parsed?.ai_company_info),
      profile_updates: parsed?.profile_updates && typeof parsed.profile_updates === "object"
        ? parsed.profile_updates
        : {},
    };
  } catch {
    return null;
  }
}

function choosePatchValue(currentValue: any, aiValue: any, overwrite: boolean) {
  const currentText = typeof currentValue === "string" ? currentValue.trim() : currentValue;
  const aiText = typeof aiValue === "string" ? aiValue.trim() : aiValue;

  if (aiText == null || aiText === "") return undefined;
  if (overwrite) return aiText;
  if (currentText == null || currentText === "") return aiText;
  return undefined;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const overwrite = Boolean(body?.overwrite);

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("*")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const [contactsRes, oppsRes, projectsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, email, phone, title, source, created_at, last_seen_at, company_id")
        .eq("account_id", profile.account_id)
        .eq("company_id", id),
      supabase
        .from("opportunities")
        .select("id, name, stage, amount, probability, service_line, last_activity_at, close_date, company_id")
        .eq("account_id", profile.account_id)
        .eq("company_id", id)
        .is("deleted_at", null),
      supabase
        .from("projects")
        .select("id, name, status, stage, health, progress_percent, support_monthly_cost, delivery_cost, company_id")
        .eq("account_id", profile.account_id)
        .eq("company_id", id),
    ]);

    if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });
    if (oppsRes.error) return NextResponse.json({ error: oppsRes.error.message }, { status: 500 });
    if (projectsRes.error) return NextResponse.json({ error: projectsRes.error.message }, { status: 500 });

    const websiteText = await fetchWebsiteText(company.website);

    let enriched: EnrichmentResponse | null = null;
    let modelUsed = "deterministic-fallback";

    try {
      enriched = await generateWithOpenAI({
        company,
        contacts: contactsRes.data || [],
        opportunities: oppsRes.data || [],
        projects: projectsRes.data || [],
        websiteText,
      });
      if (enriched) modelUsed = process.env.OPENAI_COMPANY_ENRICH_MODEL || "gpt-5-mini";
    } catch (err) {
      console.error("AI enrichment failed, using fallback:", err);
    }

    if (!enriched) {
      enriched = buildFallbackEnrichment(
        company,
        contactsRes.data || [],
        oppsRes.data || [],
        projectsRes.data || [],
        websiteText
      );
    }

    const patch: Record<string, any> = {
      ai_company_info: cleanAIInfo(enriched.ai_company_info),
      ai_company_info_generated_at: new Date().toISOString(),
      ai_company_info_model: modelUsed,
    };

    for (const field of ALLOWED_PROFILE_FIELDS) {
      const nextVal = choosePatchValue(company[field], enriched.profile_updates?.[field], overwrite);
      if (nextVal !== undefined) patch[field] = nextVal;
    }

    for (const field of NUMBER_FIELDS) {
      const aiRaw = enriched.profile_updates?.[field];
      const nextVal = choosePatchValue(company[field], aiRaw, overwrite);
      if (nextVal !== undefined) {
        const n = Number(nextVal);
        if (Number.isFinite(n)) patch[field] = n;
      }
    }

    for (const field of DATE_FIELDS) {
      const aiRaw = enriched.profile_updates?.[field];
      const nextVal = choosePatchValue(company[field], aiRaw, overwrite);
      if (typeof nextVal === "string" && nextVal.trim()) {
        patch[field] = nextVal.slice(0, 10);
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .select("*")
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json(
      {
        ok: true,
        company: updated,
        ai_company_info: updated.ai_company_info,
        model: updated.ai_company_info_model,
        websiteTextUsed: Boolean(websiteText),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/companies/[id]/enrich error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}