"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Company = Record<string, any>;

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  title?: string | null;
  company_id?: string | null;
};

type OpportunityRow = {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  service_line?: string | null;
  company_id?: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  status: string | null;
  stage: string | null;
  support_monthly_cost?: number | null;
  company_id?: string | null;
};

type RevenueRow = {
  id: string;
  title: string | null;
  amount: number | null;
  revenue_type: string | null;
  status: string | null;
  recognized_on: string | null;
  frequency: string | null;
};

type AICompanyInfo = {
  executiveSummary?: string;
  marketPositioning?: string;
  likelyNeeds?: string[];
  salesAngles?: string[];
  risks?: string[];
  recommendedNextSteps?: string[];
  leadWebsiteAnalysis?: any;
  leadScores?: {
    fit?: number | null;
    need?: number | null;
    urgency?: number | null;
    access?: number | null;
    total?: number | null;
  };
  executiveWebsiteIntel?: {
    digitalMaturity?: string | null;
    keyInsights?: string[];
    opportunities?: string[];
  };
};

function money(n: number | null | undefined) {
  const v = Number(n || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function pretty(v: string | null | undefined) {
  return v || "N/A";
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "N/A";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function chipClass(value: string | null | undefined, kind: "priority" | "lifecycle") {
  const v = String(value || "").toUpperCase();

  if (kind === "priority") {
    if (v === "HIGH" || v === "STRATEGIC") return "border-black bg-black text-white";
    if (v === "MEDIUM" || v === "STANDARD") return "border-gray-300 bg-gray-100 text-gray-900";
    if (v === "LOW") return "border-gray-200 bg-white text-gray-700";
    return "border-gray-200 bg-white text-gray-700";
  }

  if (v.includes("CUSTOMER") || v.includes("ACTIVE")) return "border-black bg-black text-white";
  if (v.includes("PROSPECT") || v.includes("TRIAL")) return "border-gray-300 bg-gray-100 text-gray-900";
  if (v.includes("LEAD")) return "border-gray-300 bg-gray-100 text-gray-900";
  if (v.includes("RISK") || v.includes("CHURN")) return "border-black bg-black text-white";
  return "border-gray-200 bg-white text-gray-700";
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function cleanServiceLabel(value: string | null | undefined) {
  const v = String(value || "").trim();
  if (!v) return "N/A";
  return v
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Company360Client({
  company,
  contacts,
  opportunities,
  projects,
  revenue,
  availableContacts,
  availableOpportunities,
  availableProjects,
}: {
  company: Company;
  contacts: ContactRow[];
  opportunities: OpportunityRow[];
  projects: ProjectRow[];
  revenue: RevenueRow[];
  availableContacts: ContactRow[];
  availableOpportunities: OpportunityRow[];
  availableProjects: ProjectRow[];
}) {
  const [tab, setTab] = useState<
    "overview" | "commercial" | "operations" | "technology" | "buying" | "relationship" | "risk" | "evidence"
  >("overview");

  const [generatingAI, setGeneratingAI] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [actionError, setActionError] = useState("");
  const [aiData, setAiData] = useState<AICompanyInfo | null>(
    (company.ai_company_info as AICompanyInfo | null) || null
  );

  const [contactSearch, setContactSearch] = useState("");
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const openPipeline = useMemo(() => {
    return opportunities
      .filter((o) => {
        const s = String(o.stage || "").toLowerCase();
        return s !== "won" && s !== "lost";
      })
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  }, [opportunities]);

  const wonRevenue = useMemo(() => {
    return opportunities
      .filter((o) => String(o.stage || "").toLowerCase() === "won")
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  }, [opportunities]);

  const supportMRR = useMemo(() => {
    return projects.reduce((sum, p) => sum + (Number(p.support_monthly_cost) || 0), 0);
  }, [projects]);

  const activeProjects = useMemo(() => {
    return projects.filter((p) => {
      const s = String(p.status || "").toLowerCase();
      return !["done", "closed", "completed", "cancelled", "canceled"].includes(s);
    }).length;
  }, [projects]);

  const filteredContacts = useMemo(() => {
    const linkedIds = new Set(contacts.map((c) => c.id));
    const q = contactSearch.trim().toLowerCase();
    return availableContacts
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => {
        const hay = `${c.name || ""} ${c.email || ""} ${c.title || ""}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 25);
  }, [availableContacts, contacts, contactSearch]);

  const filteredOpportunities = useMemo(() => {
    const linkedIds = new Set(opportunities.map((o) => o.id));
    const q = opportunitySearch.trim().toLowerCase();
    return availableOpportunities
      .filter((o) => !linkedIds.has(o.id))
      .filter((o) => {
        const hay = `${o.name || ""} ${o.stage || ""} ${o.service_line || ""}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 25);
  }, [availableOpportunities, opportunities, opportunitySearch]);

  const filteredProjects = useMemo(() => {
    const linkedIds = new Set(projects.map((p) => p.id));
    const q = projectSearch.trim().toLowerCase();
    return availableProjects
      .filter((p) => !linkedIds.has(p.id))
      .filter((p) => {
        const hay = `${p.name || ""} ${p.status || ""} ${p.stage || ""}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 25);
  }, [availableProjects, projects, projectSearch]);

  const websiteIntel = useMemo(() => {
    const aiIntel = aiData?.executiveWebsiteIntel || {};
    const raw = company.website_analysis || aiData?.leadWebsiteAnalysis || {};
    const signals = raw?.detected_signals || {};
    const keyInsights = toArray(aiIntel.keyInsights || raw?.insights || raw?.summary_points);
    const opportunities = toArray(aiIntel.opportunities || raw?.opportunities);
    const risks = toArray(raw?.risks);

    return {
      digitalMaturity: aiIntel.digitalMaturity || company.digital_maturity || raw?.digital_maturity || null,
      signals,
      keyInsights,
      opportunities,
      risks,
    };
  }, [aiData, company]);

  const leadScores = useMemo(() => {
    const scoreData = aiData?.leadScores || {};
    return {
      fit: scoreData.fit ?? null,
      need: scoreData.need ?? null,
      urgency: scoreData.urgency ?? null,
      access: scoreData.access ?? null,
      total:
        scoreData.total ??
        (() => {
          const vals = [scoreData.fit, scoreData.need, scoreData.urgency, scoreData.access]
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v));
          if (!vals.length) return null;
          return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
        })(),
    };
  }, [aiData]);

  async function handleGenerateCompanyInfo() {
    try {
      setGeneratingAI(true);
      setActionError("");

      const res = await fetch(`/api/companies/${company.id}/generate-info`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate company intelligence");
      }

      setAiData((json?.generated as AICompanyInfo) || null);
    } catch (err: any) {
      setActionError(err?.message || "Failed to generate company intelligence");
    } finally {
      setGeneratingAI(false);
    }
  }

  async function handleEnrichCompany() {
    try {
      setEnriching(true);
      setActionError("");

      const res = await fetch(`/api/companies/${company.id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: false }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to enrich company");
      }

      if (json?.ai_company_info) {
        setAiData(json.ai_company_info);
      }

      window.location.reload();
    } catch (err: any) {
      setActionError(err?.message || "Failed to enrich company");
    } finally {
      setEnriching(false);
    }
  }

  async function linkRecord(kind: "contact" | "opportunity" | "project", recordId: string) {
    if (!recordId) return;

    try {
      setActionError("");

      const res = await fetch(`/api/companies/${company.id}/link-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, recordId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || `Failed to link ${kind}`);
      }

      window.location.reload();
    } catch (err: any) {
      setActionError(err?.message || `Failed to link ${kind}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-black/10 bg-white shadow-sm">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-gray-500">Company 360</div>
              <div className="mt-1 truncate text-3xl font-semibold tracking-tight text-gray-900">
                {company.name || "Unnamed Company"}
              </div>
              <div className="mt-2 max-w-3xl text-sm text-gray-600">
                Deep customer intelligence for sales, delivery, support, and executive decision-making.
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass(company.lifecycle_stage, "lifecycle")}`}>
                  {pretty(company.lifecycle_stage)}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass(company.priority_level, "priority")}`}>
                  {pretty(company.priority_level)}
                </span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  Segment: {pretty(company.customer_segment)}
                </span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  Industry: {pretty(company.industry)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateCompanyInfo}
                disabled={generatingAI}
                className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {generatingAI ? "Generating..." : "Generate Company Info"}
              </button>

              <button
                type="button"
                onClick={handleEnrichCompany}
                disabled={enriching}
                className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {enriching ? "Enriching..." : "Enrich Company Profile"}
              </button>

              <Link
                href={`/dashboard/companies/${company.id}/edit`}
                className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Edit Company
              </Link>

              <Link
                href="/dashboard/companies"
                className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Back to Companies
              </Link>
            </div>
          </div>
        </div>
      </section>

      {actionError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Open Pipeline" value={money(openPipeline)} note={`${opportunities.length} opportunities`} />
        <Metric title="Won Revenue" value={money(wonRevenue)} note="Closed-won opportunity value" />
        <Metric title="Support MRR" value={money(supportMRR)} note="Monthly support tied to projects" />
        <Metric title="Active Projects" value={String(activeProjects)} note={`${projects.length} total projects`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {[
                ["overview", "Overview"],
                ["commercial", "Commercial"],
                ["operations", "Operations"],
                ["technology", "Technology"],
                ["buying", "Buying Process"],
                ["relationship", "Relationship"],
                ["risk", "Risk / Compliance"],
                ["evidence", "Evidence / Notes"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value as any)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                    tab === value
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {tab === "overview" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Primary Contact"
                    body={
                      <>
                        <div>{pretty(company.primary_contact_name)}</div>
                        <div className="text-sm text-gray-500">{pretty(company.primary_contact_role)}</div>
                        <div className="mt-2 text-sm">{pretty(company.primary_contact_email)}</div>
                        <div className="text-sm">{pretty(company.primary_contact_phone)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Core Identity"
                    body={
                      <>
                        <div>Website: {pretty(company.website)}</div>
                        <div>LinkedIn: {pretty(company.linkedin_url)}</div>
                        <div>Legal Name: {pretty(company.legal_name)}</div>
                        <div>Business Model: {pretty(company.business_model)}</div>
                        <div>Ownership Type: {pretty(company.ownership_type)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Location"
                    body={
                      <>
                        <div>{pretty(company.mailing_address)}</div>
                        <div>
                          {pretty(company.city)}, {pretty(company.state)} {pretty(company.postal_code)}
                        </div>
                        <div>{pretty(company.country)}</div>
                        <div className="mt-2 text-sm text-gray-500">
                          HQ: {pretty(company.headquarters_location)}
                        </div>
                      </>
                    }
                  />
                  <InfoCard
                    title="CEO Focus"
                    body={
                      <>
                        <div>Owner: {pretty(company.internal_account_owner)}</div>
                        <div>Goals: {pretty(company.primary_business_goals)}</div>
                        <div>Pain Points: {pretty(company.top_pain_points)}</div>
                        <div>Buying Motivations: {pretty(company.buying_motivations)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "commercial" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Firmographics"
                    body={
                      <>
                        <div>Industry: {pretty(company.industry)}</div>
                        <div>Industry Code: {pretty(company.industry_code)}</div>
                        <div>Company Size: {pretty(company.company_size)}</div>
                        <div>Employees: {pretty(company.employee_count_range)}</div>
                        <div>Revenue Band: {pretty(company.revenue_band)}</div>
                        <div>Revenue Level: {pretty(company.revenue_level)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Financial Profile"
                    body={
                      <>
                        <div>CLV Estimate: {money(company.clv_estimate)}</div>
                        <div>Average Order Value: {money(company.average_order_value)}</div>
                        <div>Purchase Frequency: {pretty(company.purchase_frequency)}</div>
                        <div>Last Purchase Date: {fmtDate(company.last_purchase_date)}</div>
                        <div>Payment Terms: {pretty(company.payment_terms_history)}</div>
                        <div>Outstanding Invoices: {pretty(company.outstanding_invoices)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "operations" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Operations & KPIs"
                    body={
                      <>
                        <div>Customer KPIs: {pretty(company.customer_kpis)}</div>
                        <div>Baseline KPIs: {pretty(company.baseline_kpis)}</div>
                        <div>Target KPIs: {pretty(company.target_kpis)}</div>
                        <div>Operational Cadence: {pretty(company.operational_cadence)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="JTBD + Problem"
                    body={
                      <>
                        <div>Jobs To Be Done: {pretty(company.jobs_to_be_done)}</div>
                        <div>Current Workarounds: {pretty(company.current_workarounds)}</div>
                        <div>Solution Triggers: {pretty(company.solution_triggers)}</div>
                        <div>Consequences of Failure: {pretty(company.consequences_of_failure)}</div>
                        <div>Problem Frequency / Severity: {pretty(company.problem_frequency_severity)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "technology" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Technographics"
                    body={
                      <>
                        <div>Primary Platforms: {pretty(company.primary_software_platforms)}</div>
                        <div>Hardware / Equipment: {pretty(company.hardware_equipment)}</div>
                        <div>Integration Points: {pretty(company.integration_points)}</div>
                        <div>IT Decision Maker: {pretty(company.it_decision_maker)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Security / Compliance"
                    body={
                      <>
                        <div>Security Requirements: {pretty(company.security_compliance_requirements)}</div>
                        <div>Privacy Constraints: {pretty(company.privacy_constraints)}</div>
                        <div>Regulatory Constraints: {pretty(company.regulatory_constraints)}</div>
                        <div>Insurance Requirements: {pretty(company.insurance_requirements)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "buying" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Decision Process"
                    body={
                      <>
                        <div>Buying Committee: {pretty(company.buying_committee)}</div>
                        <div>Approval Thresholds: {pretty(company.approval_thresholds)}</div>
                        <div>Procurement Steps: {pretty(company.procurement_steps)}</div>
                        <div>Preferred Vendor Rules: {pretty(company.preferred_vendors_rules)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Commercial Motion"
                    body={
                      <>
                        <div>Procurement Cycle Days: {pretty(String(company.procurement_cycle_days || ""))}</div>
                        <div>Contracting / Billing Preferences: {pretty(company.contracting_billing_preferences)}</div>
                        <div>Negotiation Levers: {pretty(company.objections_negotiation_levers)}</div>
                        <div>Risk Tolerance: {pretty(company.risk_tolerance)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "relationship" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Relationship History"
                    body={
                      <>
                        <div>Initial Engagement Source: {pretty(company.initial_engagement_source)}</div>
                        <div>Relationship Summary: {pretty(company.relationship_summary)}</div>
                        <div>Channel Preferences: {pretty(company.channel_preferences)}</div>
                        <div>Engagement History: {pretty(company.engagement_history)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Support / Renewal"
                    body={
                      <>
                        <div>Support Interactions: {pretty(company.support_interactions)}</div>
                        <div>Support Ticket History: {pretty(company.support_ticket_history)}</div>
                        <div>SLA Breaches: {pretty(company.sla_commitments_breaches)}</div>
                        <div>CSAT / NPS: {pretty(company.csat_nps)}</div>
                        <div>Renewal Conversations: {pretty(company.renewal_conversations)}</div>
                        <div>Renewal / Churn Signals: {pretty(company.renewal_churn_signals)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "risk" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Legal / Compliance"
                    body={
                      <>
                        <div>Contract Clauses: {pretty(company.contract_clauses_of_note)}</div>
                        <div>Regulatory Constraints: {pretty(company.regulatory_constraints)}</div>
                        <div>Privacy Constraints: {pretty(company.privacy_constraints)}</div>
                        <div>Export Controls: {pretty(company.export_controls_flags)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Strategic Risk Signals"
                    body={
                      <>
                        <div>Priority Level: {pretty(company.priority_level)}</div>
                        <div>Lifecycle Stage: {pretty(company.lifecycle_stage)}</div>
                        <div>Custom Tags: {pretty(company.custom_tags)}</div>
                        <div>Values / Culture Signals: {pretty(company.values_culture_signals)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}

              {tab === "evidence" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Qualitative Evidence"
                    body={
                      <>
                        <div>Interview Quotes: {pretty(company.interview_transcripts_quotes)}</div>
                        <div>Case Studies: {pretty(company.case_studies)}</div>
                        <div>Feature Requests: {pretty(company.feedback_feature_requests)}</div>
                      </>
                    }
                  />
                  <InfoCard
                    title="Artifacts / Notes"
                    body={
                      <>
                        <div>Onboarding Notes: {pretty(company.onboarding_notes)}</div>
                        <div>Org Chart Notes: {pretty(company.org_chart_notes)}</div>
                        <div>Facilities Summary: {pretty(company.facilities_summary)}</div>
                        <div>Top Three Customers: {pretty(company.top_three_customers)}</div>
                      </>
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="space-y-4">
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">AI Company Intelligence</div>
              <div className="mt-1 text-sm text-gray-600">
                Freshware-generated summary to support sales, delivery, and future lead targeting.
              </div>

              <div className="mt-4 space-y-3">
                <IntelBlock title="Executive Summary" value={aiData?.executiveSummary} />
                <IntelBlock title="Market Positioning" value={aiData?.marketPositioning} />
                <IntelListBlock title="Likely Needs" items={aiData?.likelyNeeds} />
                <IntelListBlock title="Sales Angles" items={aiData?.salesAngles} />
                <IntelListBlock title="Risks / Red Flags" items={aiData?.risks} />
                <IntelListBlock title="Recommended Next Steps" items={aiData?.recommendedNextSteps} />
                <div className="text-xs text-gray-500">
                  Model: {pretty(company.ai_company_info_model)} • Updated: {fmtDate(company.ai_company_info_generated_at)}
                </div>
              </div>
            </div>

            <ExecutiveLeadIntelCard
              website={company.website}
              detectedNeed={company.top_pain_points}
              recommendedService={company.recommended_service_line}
              aiSummary={company.relationship_summary || aiData?.executiveSummary}
              leadScores={leadScores}
              websiteIntel={websiteIntel}
            />

            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Link Existing Records</div>
              <div className="mt-1 text-sm text-gray-600">
                Search account records and attach them to this company profile.
              </div>

              <div className="mt-4 space-y-5">
                <LinkPicker
                  title="Link Contact"
                  search={contactSearch}
                  setSearch={setContactSearch}
                  selectedId={selectedContactId}
                  setSelectedId={setSelectedContactId}
                  options={filteredContacts.map((c) => ({
                    id: c.id,
                    label: `${c.name || "Unnamed"}${c.title ? ` • ${c.title}` : ""}${c.email ? ` • ${c.email}` : ""}`,
                  }))}
                  buttonLabel="Link Contact"
                  onLink={() => linkRecord("contact", selectedContactId)}
                />

                <LinkPicker
                  title="Link Opportunity"
                  search={opportunitySearch}
                  setSearch={setOpportunitySearch}
                  selectedId={selectedOpportunityId}
                  setSelectedId={setSelectedOpportunityId}
                  options={filteredOpportunities.map((o) => ({
                    id: o.id,
                    label: `${o.name || "Unnamed"}${o.stage ? ` • ${o.stage}` : ""}${o.service_line ? ` • ${cleanServiceLabel(o.service_line)}` : ""}`,
                  }))}
                  buttonLabel="Link Opportunity"
                  onLink={() => linkRecord("opportunity", selectedOpportunityId)}
                />

                <LinkPicker
                  title="Link Project"
                  search={projectSearch}
                  setSearch={setProjectSearch}
                  selectedId={selectedProjectId}
                  setSelectedId={setSelectedProjectId}
                  options={filteredProjects.map((p) => ({
                    id: p.id,
                    label: `${p.name || "Unnamed"}${p.status ? ` • ${p.status}` : ""}${p.stage ? ` • ${p.stage}` : ""}`,
                  }))}
                  buttonLabel="Link Project"
                  onLink={() => linkRecord("project", selectedProjectId)}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Related Records</div>
              <div className="mt-4 grid gap-3">
                <MiniMetric label="Contacts" value={String(contacts.length)} />
                <MiniMetric
                  label="Open Opportunities"
                  value={String(
                    opportunities.filter((o) => {
                      const s = String(o.stage || "").toLowerCase();
                      return s !== "won" && s !== "lost";
                    }).length
                  )}
                />
                <MiniMetric label="Projects" value={String(projects.length)} />
                <MiniMetric label="Revenue Entries" value={String(revenue.length)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ListCard
          title="Contacts"
          rows={contacts.map((c) => ({
            id: c.id,
            title: c.name || c.email || c.id,
            sub: `${c.title || "Contact"}${c.email ? ` • ${c.email}` : ""}`,
            href: `/dashboard/contacts/${c.id}`,
          }))}
        />

        <ListCard
          title="Opportunities"
          rows={opportunities.map((o) => ({
            id: o.id,
            title: o.name || o.id,
            sub: `${pretty(o.stage)} • ${money(o.amount)} • ${cleanServiceLabel(o.service_line)}`,
            href: `/dashboard/opportunities/${o.id}`,
          }))}
        />

        <ListCard
          title="Projects"
          rows={projects.map((p) => ({
            id: p.id,
            title: p.name || p.id,
            sub: `${pretty(p.stage)} • ${pretty(p.status)} • ${money(p.support_monthly_cost)}`,
            href: `/dashboard/projects/${p.id}`,
          }))}
        />
      </section>
    </div>
  );
}

function Metric(props: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      <div className="mt-2 text-sm text-gray-600">{props.note}</div>
    </div>
  );
}

function InfoCard(props: { title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-3 space-y-1 text-sm text-gray-700">{props.body}</div>
    </div>
  );
}

function IntelBlock(props: { title: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.title}</div>
      <div className="mt-2 text-sm text-gray-700">{props.value || "No generated intelligence yet."}</div>
    </div>
  );
}

function IntelListBlock(props: { title: string; items: string[] | null | undefined }) {
  const items = Array.isArray(props.items) ? props.items : [];

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.title}</div>
      <div className="mt-2 text-sm text-gray-700">
        {items.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {items.map((item, idx) => (
              <li key={`${props.title}-${idx}`} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          "No generated intelligence yet."
        )}
      </div>
    </div>
  );
}

function MiniMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs text-gray-500">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{props.value}</div>
    </div>
  );
}

function LinkPicker(props: {
  title: string;
  search: string;
  setSearch: (v: string) => void;
  selectedId: string;
  setSelectedId: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  buttonLabel: string;
  onLink: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <input
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
        placeholder="Search..."
        className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
      />
      <select
        value={props.selectedId}
        onChange={(e) => props.setSelectedId(e.target.value)}
        className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
      >
        <option value="">Select a record</option>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={props.onLink}
        disabled={!props.selectedId}
        className="mt-3 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
      >
        {props.buttonLabel}
      </button>
    </div>
  );
}

function ListCard(props: {
  title: string;
  rows: Array<{ id: string; title: string; sub: string; href: string }>;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="text-lg font-semibold text-gray-900">{props.title}</div>
      <div className="mt-4 space-y-3">
        {props.rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="block rounded-2xl border border-black/10 p-4 transition hover:bg-gray-50"
          >
            <div className="text-sm font-semibold text-gray-900">{row.title}</div>
            <div className="mt-1 text-xs text-gray-500">{row.sub}</div>
          </Link>
        ))}
        {!props.rows.length ? (
          <div className="text-sm text-gray-500">No records yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function ExecutiveLeadIntelCard(props: {
  website: string | null | undefined;
  detectedNeed: string | null | undefined;
  recommendedService: string | null | undefined;
  aiSummary: string | null | undefined;
  leadScores: {
    fit?: number | null;
    need?: number | null;
    urgency?: number | null;
    access?: number | null;
    total?: number | null;
  };
  websiteIntel: {
    digitalMaturity: string | null;
    signals: Record<string, any>;
    keyInsights: string[];
    opportunities: string[];
    risks: string[];
  };
}) {
  const hasIntel =
    props.website ||
    props.detectedNeed ||
    props.recommendedService ||
    props.aiSummary ||
    props.websiteIntel.digitalMaturity ||
    props.websiteIntel.keyInsights.length ||
    props.websiteIntel.opportunities.length ||
    props.websiteIntel.risks.length ||
    props.leadScores.total != null;

  if (!hasIntel) return null;

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="text-lg font-semibold text-gray-900">Lead Intelligence</div>
      <div className="mt-1 text-sm text-gray-600">
        Converted lead analysis surfaced in an executive-friendly format.
      </div>

      <div className="mt-4 space-y-3">
        <IntelBlock title="Website" value={props.website} />
        <IntelBlock title="Detected Need" value={props.detectedNeed} />
        <IntelBlock title="Recommended Service" value={cleanServiceLabel(props.recommendedService)} />
        <IntelBlock title="AI Summary" value={props.aiSummary} />

        <div className="grid grid-cols-2 gap-3">
          <MiniMetric label="Overall Score" value={props.leadScores.total != null ? String(props.leadScores.total) : "N/A"} />
          <MiniMetric label="Digital Maturity" value={pretty(props.websiteIntel.digitalMaturity)} />
          <MiniMetric label="Fit" value={props.leadScores.fit != null ? String(props.leadScores.fit) : "N/A"} />
          <MiniMetric label="Need" value={props.leadScores.need != null ? String(props.leadScores.need) : "N/A"} />
          <MiniMetric label="Urgency" value={props.leadScores.urgency != null ? String(props.leadScores.urgency) : "N/A"} />
          <MiniMetric label="Access" value={props.leadScores.access != null ? String(props.leadScores.access) : "N/A"} />
        </div>

        <WebsiteIntelBlock
          signals={props.websiteIntel.signals}
          keyInsights={props.websiteIntel.keyInsights}
          opportunities={props.websiteIntel.opportunities}
          risks={props.websiteIntel.risks}
        />
      </div>
    </div>
  );
}

function WebsiteIntelBlock(props: {
  signals: Record<string, any>;
  keyInsights: string[];
  opportunities: string[];
  risks: string[];
}) {
  const {
    hasHttps = false,
    hasBooking = false,
    hasEcommerce = false,
    hasContactForm = false,
    hasPortal = false,
    hasAppLanguage = false,
  } = props.signals || {};

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Website Intelligence
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniSignal label="HTTPS" value={hasHttps ? "Yes" : "No"} />
        <MiniSignal label="Booking Flow" value={hasBooking ? "Yes" : "No"} />
        <MiniSignal label="Contact Form" value={hasContactForm ? "Yes" : "No"} />
        <MiniSignal label="Portal / App" value={hasPortal || hasAppLanguage ? "Yes" : "No"} />
        <MiniSignal label="Ecommerce" value={hasEcommerce ? "Yes" : "No"} />
        <MiniSignal label="Modern Signals" value={hasHttps || hasContactForm || hasPortal ? "Some" : "Weak"} />
      </div>

      {props.keyInsights.length ? (
        <IntelListBlock title="Key Insights" items={props.keyInsights} />
      ) : null}

      {props.opportunities.length ? (
        <IntelListBlock title="Opportunities" items={props.opportunities} />
      ) : null}

      {props.risks.length ? (
        <IntelListBlock title="Risks" items={props.risks} />
      ) : null}
    </div>
  );
}

function MiniSignal(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{props.value}</div>
    </div>
  );
}