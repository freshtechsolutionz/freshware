import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

type CompanyRow = {
  id: string;
  name: string | null;
  industry: string | null;
  company_size: string | null;
  employee_count_range: string | null;
  revenue_band: string | null;
  headquarters_location: string | null;
  business_model: string | null;
  ownership_type: string | null;
  company_age: string | null;
  customer_segment: string | null;
  lifecycle_stage: string | null;

  primary_contact_name: string | null;
  primary_contact_role: string | null;
  primary_contact_email: string | null;

  key_decision_makers: string | null;
  buying_committee: string | null;
  approval_thresholds: string | null;

  primary_business_goals: string | null;
  top_pain_points: string | null;
  buying_motivations: string | null;
  risk_tolerance: string | null;
  values_culture_signals: string | null;

  jobs_to_be_done: string | null;
  current_workarounds: string | null;
  solution_triggers: string | null;
  consequences_of_failure: string | null;
  problem_frequency_severity: string | null;

  primary_software_platforms: string | null;
  integration_points: string | null;
  it_decision_maker: string | null;
  security_compliance_requirements: string | null;

  customer_kpis: string | null;
  baseline_kpis: string | null;
  target_kpis: string | null;

  engagement_history: string | null;
  website_behavior: string | null;
  support_interactions: string | null;
  renewal_churn_signals: string | null;

  clv_estimate: number | null;
  average_order_value: number | null;
  purchase_frequency: string | null;
  last_purchase_date: string | null;

  procurement_cycle_days: number | null;
  procurement_steps: string | null;
  preferred_vendors_rules: string | null;
  objections_negotiation_levers: string | null;

  relationship_summary: string | null;
  initial_engagement_source: string | null;

  ai_company_info: Record<string, unknown> | null;
  ai_company_info_generated_at: string | null;
  ai_company_info_model: string | null;
};

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: string | null;
  created_at: string | null;
  source_ref: string | null;
  imported_at: string | null;
  owner_profile_id: string | null;
  last_seen_at: string | null;
  company_id: string | null;
};

type OpportunityRow = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  last_activity_at: string | null;
  created_at: string | null;
  name: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  company_id: string | null;
};

type ProjectRow = {
  id: string;
  opportunity_id: string | null;
  name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  health: string | null;
  account_id: string | null;
  created_by: string | null;
  stage: string | null;
  description: string | null;
  internal_notes: string | null;
  support_cost: number | null;
  support_due_date: string | null;
  delivery_cost: number | null;
  support_monthly_cost: number | null;
  support_start_date: string | null;
  support_next_due_date: string | null;
  support_status: string | null;
  progress_percent: number | null;
  company_id: string | null;
};

type GeneratedCompanyInfo = {
  executiveSummary: string;
  marketPositioning: string;
  likelyNeeds: string[];
  salesAngles: string[];
  risks: string[];
  recommendedNextSteps: string[];
};

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function splitToList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\r?\n|•|;|,| - /g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function compact<T>(values: Array<T | null | undefined | false | "">): T[] {
  return values.filter(Boolean) as T[];
}

function isClosedLost(stage: string | null | undefined): boolean {
  const s = (stage || "").toLowerCase().trim();
  return s === "closed lost" || s === "lost";
}

function isCompletedProject(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  return s === "completed" || s === "cancelled" || s === "canceled";
}

function isRiskHealth(health: string | null | undefined): boolean {
  const h = (health || "").toLowerCase().trim();
  return h === "red" || h === "yellow" || h === "at risk" || h === "atrisk";
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

function cleanGeneratedInfo(raw: Partial<GeneratedCompanyInfo> | null | undefined): GeneratedCompanyInfo {
  return {
    executiveSummary: safeText(raw?.executiveSummary),
    marketPositioning: safeText(raw?.marketPositioning),
    likelyNeeds: uniq(Array.isArray(raw?.likelyNeeds) ? raw!.likelyNeeds.map((x) => safeText(x)).filter(Boolean) : []),
    salesAngles: uniq(Array.isArray(raw?.salesAngles) ? raw!.salesAngles.map((x) => safeText(x)).filter(Boolean) : []),
    risks: uniq(Array.isArray(raw?.risks) ? raw!.risks.map((x) => safeText(x)).filter(Boolean) : []),
    recommendedNextSteps: uniq(
      Array.isArray(raw?.recommendedNextSteps)
        ? raw!.recommendedNextSteps.map((x) => safeText(x)).filter(Boolean)
        : []
    ),
  };
}

function buildDeterministicSummary(
  company: CompanyRow,
  contacts: ContactRow[],
  opportunities: OpportunityRow[],
  projects: ProjectRow[]
): GeneratedCompanyInfo {
  const companyName = company.name || "This company";
  const industry = company.industry || "its industry";
  const segment = company.customer_segment || "its target segment";
  const lifecycleStage = company.lifecycle_stage || "an undefined lifecycle stage";
  const businessModel = company.business_model || "its business model";
  const size = company.company_size || company.employee_count_range || "an unspecified company size";
  const hq = company.headquarters_location || "its current market";

  const painPoints = splitToList(company.top_pain_points);
  const motivations = splitToList(company.buying_motivations);
  const triggers = splitToList(company.solution_triggers);
  const workarounds = splitToList(company.current_workarounds);
  const jtbd = splitToList(company.jobs_to_be_done);
  const objections = splitToList(company.objections_negotiation_levers);
  const procurementSteps = splitToList(company.procurement_steps);
  const integrations = splitToList(company.integration_points);
  const software = splitToList(company.primary_software_platforms);
  const goals = splitToList(company.primary_business_goals);
  const churnSignals = splitToList(company.renewal_churn_signals);
  const supportSignals = splitToList(company.support_interactions);

  const openOpps = opportunities.filter((opp) => !isClosedLost(opp.stage));
  const projectsInFlight = projects.filter((project) => !isCompletedProject(project.status));
  const riskyProjects = projects.filter((project) => isRiskHealth(project.health));

  const serviceLines = uniq(
    opportunities
      .map((opp) => safeText(opp.service_line))
      .filter(Boolean)
  );

  const leadershipContacts = contacts.filter((contact) =>
    /(ceo|founder|owner|president|vp|vice president|director|head|manager|principal)/i.test(
      contact.title || ""
    )
  );

  const likelyNeeds = compact<string>([
    painPoints[0] ? `A solution that directly addresses ${painPoints[0]}` : null,
    painPoints[1] ? `Operational support around ${painPoints[1]}` : null,
    jtbd[0] ? `A system that helps them accomplish: ${jtbd[0]}` : null,
    workarounds[0] ? `Replacing current workaround-driven processes with a more scalable workflow` : null,
    software.length ? `Integration or optimization across current software platforms` : null,
    integrations.length ? `Support for system integration and data flow between tools` : null,
    projectsInFlight.length ? `Delivery visibility, reporting, and structured account expansion` : null,
    openOpps.length ? `A phased path to convert active opportunity interest into committed work` : null,
  ]).slice(0, 6);

  const salesAngles = compact<string>([
    goals[0] ? `Tie the conversation to their stated business goal: ${goals[0]}` : null,
    motivations[0] ? `Lead with their buying motivation: ${motivations[0]}` : null,
    triggers[0] ? `Use the identified trigger event to create urgency: ${triggers[0]}` : null,
    serviceLines.length ? `Position Fresh Tech around ${serviceLines.slice(0, 2).join(" and ")}` : null,
    leadershipContacts.length
      ? `Frame value for executive stakeholders around ROI, control, visibility, and growth`
      : `Identify and align messaging to the true decision-maker before pushing a proposal`,
    company.primary_software_platforms
      ? `Position technology work as a business systems improvement, not just a build request`
      : `Sell strategic clarity and phased execution before full implementation`,
  ]).slice(0, 6);

  const risks = compact<string>([
    objections[0] ? `Known objection or negotiation pressure: ${objections[0]}` : null,
    churnSignals[0] ? `Potential churn or relationship instability signal: ${churnSignals[0]}` : null,
    riskyProjects.length ? `One or more active projects show delivery risk or health concerns` : null,
    !leadershipContacts.length && !company.key_decision_makers
      ? `Decision-maker visibility is weak, which may slow conversion`
      : null,
    procurementSteps.length ? `Procurement process may add cycle time and friction to closing` : null,
    supportSignals[0] ? `Support history may create delivery or relationship sensitivity` : null,
    !company.top_pain_points ? `Pain points are not fully documented, limiting sales precision` : null,
  ]).slice(0, 6);

  const recommendedNextSteps = compact<string>([
    `Validate and complete the Company 360 profile for ${companyName}, especially pain points, decision-makers, and procurement fields`,
    leadershipContacts.length
      ? `Engage ${leadershipContacts[0]?.name || "the identified executive contact"} with an outcome-focused conversation`
      : `Add and confirm the primary economic buyer and technical buyer`,
    openOpps.length
      ? `Advance the strongest open opportunity to a specific next milestone, proposal, or meeting`
      : `Create a discovery opportunity tied to the company’s most urgent problem`,
    projectsInFlight.length
      ? `Use current project activity to identify upsell, cross-sell, or support expansion opportunities`
      : `Recommend a phased pilot or low-risk first engagement`,
    riskyProjects.length
      ? `Address project health risks before pushing major expansion conversations`
      : `Package the next recommendation around measurable business outcomes and reduced operational friction`,
  ]).slice(0, 6);

  const executiveSummary = [
    `${companyName} appears to be a ${size} ${industry} company operating in ${hq}, serving ${segment} through ${businessModel}.`,
    `The account currently sits in ${lifecycleStage} and shows ${openOpps.length ? `${openOpps.length} active opportunity record(s)` : "limited active opportunity movement"}.`,
    projectsInFlight.length
      ? `There are ${projectsInFlight.length} active project relationship(s), which creates expansion potential if delivery remains strong.`
      : `There is no current active project footprint, so trust-building and a sharp first engagement strategy will matter.`,
    painPoints.length
      ? `The strongest signal in the profile is around ${painPoints.slice(0, 2).join(" and ")}.`
      : `The profile suggests opportunity, but stronger pain point documentation would improve sales precision.`,
  ].join(" ");

  const marketPositioning = [
    `${companyName} should be positioned as a company that likely values business outcomes over generic tech delivery.`,
    goals[0]
      ? `The strongest market positioning is to connect Fresh Tech Solutionz to ${goals[0].toLowerCase()}`
      : `The strongest market positioning is around efficiency, visibility, and scalable growth enablement`,
    company.primary_software_platforms
      ? `while improving or integrating the systems they already rely on.`
      : `while helping the organization formalize and modernize its operating approach.`,
  ].join(" ");

  return {
    executiveSummary,
    marketPositioning,
    likelyNeeds,
    salesAngles,
    risks,
    recommendedNextSteps,
  };
}

async function generateWithOpenAI(input: {
  company: CompanyRow;
  contacts: ContactRow[];
  opportunities: OpportunityRow[];
  projects: ProjectRow[];
}): Promise<GeneratedCompanyInfo | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_COMPANY_INFO_MODEL || "gpt-5-mini";

  const prompt = `
You are an elite B2B sales strategist and operator.

Your job is to analyze a Company 360 profile and generate high-level, actionable intelligence for closing deals, expanding accounts, and reducing risk.

Return STRICT JSON in this exact format:
{
  "executiveSummary": "string",
  "marketPositioning": "string",
  "likelyNeeds": ["string"],
  "salesAngles": ["string"],
  "risks": ["string"],
  "recommendedNextSteps": ["string"]
}

Rules:
- Use ONLY the provided data
- Do not hallucinate facts
- Think like a CEO + Head of Sales
- Prioritize revenue, risk, conversion, and account growth
- Be specific and practical
- Each array item should be concise but meaningful
- executiveSummary should be 2-4 sentences max
- marketPositioning should be 2-4 sentences max
- recommendedNextSteps should be action-oriented and prioritized

Focus areas:
- Pain points to opportunities
- Behavior to buying readiness
- Financial signals to urgency and value
- Tech stack to integration and optimization opportunities
- Lifecycle stage to sales strategy
- Risks to blockers and friction

Company data:
${JSON.stringify(
  {
    company: input.company,
    contacts: input.contacts,
    opportunities: input.opportunities,
    projects: input.projects,
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
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = jsonFromResponsePayload(data);

  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return cleanGeneratedInfo(parsed);
  } catch {
    return null;
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing company id" }, { status: 400 });
    }

    const companyQuery = await supabase
      .from("companies")
      .select(`
        id,
        name,
        industry,
        company_size,
        employee_count_range,
        revenue_band,
        headquarters_location,
        business_model,
        ownership_type,
        company_age,
        customer_segment,
        lifecycle_stage,

        primary_contact_name,
        primary_contact_role,
        primary_contact_email,

        key_decision_makers,
        buying_committee,
        approval_thresholds,

        primary_business_goals,
        top_pain_points,
        buying_motivations,
        risk_tolerance,
        values_culture_signals,

        jobs_to_be_done,
        current_workarounds,
        solution_triggers,
        consequences_of_failure,
        problem_frequency_severity,

        primary_software_platforms,
        integration_points,
        it_decision_maker,
        security_compliance_requirements,

        customer_kpis,
        baseline_kpis,
        target_kpis,

        engagement_history,
        website_behavior,
        support_interactions,
        renewal_churn_signals,

        clv_estimate,
        average_order_value,
        purchase_frequency,
        last_purchase_date,

        procurement_cycle_days,
        procurement_steps,
        preferred_vendors_rules,
        objections_negotiation_levers,

        relationship_summary,
        initial_engagement_source,

        ai_company_info,
        ai_company_info_generated_at,
        ai_company_info_model
      `)
      .eq("id", id)
      .single();

    if (companyQuery.error || !companyQuery.data) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const company = companyQuery.data as CompanyRow;

    const [contactsRes, oppsRes, projectsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select(`
          id,
          name,
          email,
          phone,
          title,
          source,
          created_at,
          source_ref,
          imported_at,
          owner_profile_id,
          last_seen_at,
          company_id
        `)
        .eq("company_id", id),

      supabase
        .from("opportunities")
        .select(`
          id,
          account_id,
          contact_id,
          owner_user_id,
          service_line,
          stage,
          amount,
          probability,
          close_date,
          last_activity_at,
          created_at,
          name,
          deleted_at,
          deleted_by,
          company_id
        `)
        .eq("company_id", id)
        .is("deleted_at", null),

      supabase
        .from("projects")
        .select(`
          id,
          opportunity_id,
          name,
          status,
          start_date,
          due_date,
          owner_user_id,
          created_at,
          health,
          account_id,
          created_by,
          stage,
          description,
          internal_notes,
          support_cost,
          support_due_date,
          delivery_cost,
          support_monthly_cost,
          support_start_date,
          support_next_due_date,
          support_status,
          progress_percent,
          company_id
        `)
        .eq("company_id", id),
    ]);

    if (contactsRes.error) {
      console.error("Contacts query failed:", contactsRes.error);
      return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
    }

    if (oppsRes.error) {
      console.error("Opportunities query failed:", oppsRes.error);
      return NextResponse.json({ error: "Failed to load opportunities" }, { status: 500 });
    }

    if (projectsRes.error) {
      console.error("Projects query failed:", projectsRes.error);
      return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
    }

    const contacts = (contactsRes.data || []) as ContactRow[];
    const opportunities = ((oppsRes.data || []) as OpportunityRow[]).map((opp) => ({
      ...opp,
      amount: safeNumber(opp.amount),
      probability: safeNumber(opp.probability),
    }));

    const projects = ((projectsRes.data || []) as ProjectRow[]).map((project) => ({
      ...project,
      support_cost: safeNumber(project.support_cost),
      delivery_cost: safeNumber(project.delivery_cost),
      support_monthly_cost: safeNumber(project.support_monthly_cost),
      progress_percent: safeNumber(project.progress_percent),
    }));

    let generated: GeneratedCompanyInfo | null = null;
    let modelUsed = "deterministic-fallback";

    try {
      generated = await generateWithOpenAI({
        company,
        contacts,
        opportunities,
        projects,
      });

      if (generated) {
        modelUsed = process.env.OPENAI_COMPANY_INFO_MODEL || "gpt-5-mini";
      }
    } catch (error) {
      console.error("AI generation failed, using fallback:", error);
    }

    if (!generated) {
      generated = buildDeterministicSummary(company, contacts, opportunities, projects);
    }

    const cleanPayload = cleanGeneratedInfo(generated);

    const updateRes = await supabase
      .from("companies")
      .update({
        ai_company_info: cleanPayload,
        ai_company_info_generated_at: new Date().toISOString(),
        ai_company_info_model: modelUsed,
      })
      .eq("id", id)
      .select("id, ai_company_info, ai_company_info_generated_at, ai_company_info_model")
      .single();

    if (updateRes.error || !updateRes.data) {
      console.error("Failed to save generated company info:", updateRes.error);
      return NextResponse.json(
        { error: "Failed to save generated company info" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      companyId: id,
      generated: updateRes.data.ai_company_info,
      generatedAt: updateRes.data.ai_company_info_generated_at,
      model: updateRes.data.ai_company_info_model,
    });
  } catch (error) {
    console.error("POST /api/companies/[id]/generate-info error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}