import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const { id } = await context.params;

  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select(`
      id, name, website, industry, city, state, customer_segment,
      lifecycle_stage, priority_level, primary_business_goals,
      top_pain_points, internal_account_owner, business_model,
      company_size, revenue_band
    `)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const summary = [
    `${company.name || "This company"} is currently tracked in Freshware`,
    company.industry ? `in the ${company.industry} industry` : null,
    company.customer_segment ? `as a ${company.customer_segment} segment customer` : null,
    company.lifecycle_stage ? `with lifecycle stage ${company.lifecycle_stage}` : null,
    company.priority_level ? `and priority ${company.priority_level}` : null,
  ]
    .filter(Boolean)
    .join(" ") + ".";

  const likelyNeeds = [
    company.top_pain_points ? `Pain points noted: ${company.top_pain_points}.` : null,
    company.primary_business_goals ? `Goals noted: ${company.primary_business_goals}.` : null,
    company.business_model ? `Business model: ${company.business_model}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const recommendedNextSteps = [
    "Review company website and positioning.",
    "Confirm decision-makers and buying committee.",
    "Align proposal to pain points, KPIs, and lifecycle stage.",
    "Identify best Fresh Tech Solutionz offer: app, software, website, AI integration, or support plan.",
  ].join(" ");

  const { data, error } = await supabase
    .from("company_intelligence")
    .insert({
      account_id: profile.account_id,
      company_id: company.id,
      generated_by: user.id,
      source: "freshware-placeholder-generator",
      summary,
      website_summary: company.website ? `Website on file: ${company.website}` : "No website on file.",
      market_positioning: company.industry
        ? `${company.name || "Company"} appears positioned within ${company.industry}.`
        : "Market positioning not yet confirmed.",
      likely_needs: likelyNeeds || "Needs not yet clearly defined.",
      sales_angles: "Lead with business outcomes, operational efficiency, revenue growth, and customer experience.",
      risks_red_flags: "Validate budget, urgency, decision-makers, and internal ownership before advancing.",
      recommended_next_steps: recommendedNextSteps,
      ai_confidence: "Low - starter generation using internal CRM fields only.",
      raw_output: company,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ intelligence: data }, { status: 201 });
}