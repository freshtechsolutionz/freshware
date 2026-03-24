"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Company = Record<string, any>;
type FormState = Record<string, any>;

type FieldType = "text" | "textarea" | "number" | "date" | "email" | "url";

type FieldConfig = {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  rows?: number;
  colSpan?: 1 | 2;
  helpText?: string;
};

type SectionConfig = {
  key: string;
  title: string;
  description?: string;
  fields: FieldConfig[];
};

const SECTIONS: SectionConfig[] = [
  {
    key: "core",
    title: "Core Identity and Contact",
    description: "Basic company identity, contact info, and communication preferences.",
    fields: [
      { name: "name", label: "Account Name", type: "text" },
      { name: "legal_name", label: "Legal Name", type: "text" },
      { name: "website", label: "Website", type: "url" },
      { name: "linkedin_url", label: "LinkedIn URL", type: "url" },
      { name: "email", label: "Company Email", type: "email" },
      { name: "phone", label: "Company Phone", type: "text" },
      { name: "mailing_address", label: "Mailing Address", type: "text", colSpan: 2 },
      { name: "city", label: "City", type: "text" },
      { name: "state", label: "State", type: "text" },
      { name: "postal_code", label: "Postal Code", type: "text" },
      { name: "country", label: "Country", type: "text" },
      { name: "preferred_contact_method", label: "Preferred Contact Method", type: "text" },
      { name: "primary_contact_name", label: "Primary Contact Name", type: "text" },
      { name: "primary_contact_role", label: "Primary Contact Role / Title", type: "text" },
      { name: "primary_contact_email", label: "Primary Contact Email", type: "email" },
      { name: "primary_contact_phone", label: "Primary Contact Phone", type: "text" },
      {
        name: "secondary_contacts",
        label: "Secondary Contacts (JSON)",
        type: "textarea",
        rows: 6,
        colSpan: 2,
        helpText: 'Use valid JSON, for example: [{"name":"Jane Doe","role":"COO","email":"jane@company.com"}]',
      },
    ],
  },
  {
    key: "firmographics",
    title: "Firmographic and Organizational Attributes",
    description: "How the business is structured and how it buys.",
    fields: [
      { name: "industry", label: "Industry Sector", type: "text" },
      { name: "industry_code", label: "Industry Code (NAICS/SIC)", type: "text" },
      { name: "company_size", label: "Company Size", type: "text" },
      { name: "employee_count_range", label: "Employee Count Range", type: "text" },
      { name: "revenue_band", label: "Revenue Band", type: "text" },
      { name: "headquarters_location", label: "Headquarters Location", type: "text" },
      { name: "legal_entity", label: "Legal Entity", type: "text" },
      { name: "tax_id", label: "Tax ID", type: "text" },
      { name: "business_model", label: "Business Model", type: "text" },
      { name: "ownership_type", label: "Ownership Type", type: "text" },
      { name: "key_decision_makers", label: "Key Decision Makers", type: "textarea", rows: 4, colSpan: 2 },
      { name: "org_chart_notes", label: "Organizational Chart Notes", type: "textarea", rows: 4, colSpan: 2 },
      { name: "procurement_cycle_days", label: "Procurement Cycle Days", type: "number" },
      {
        name: "contracting_billing_preferences",
        label: "Contracting and Billing Preferences",
        type: "textarea",
        rows: 4,
        colSpan: 2,
      },
    ],
  },
  {
    key: "company-profile",
    title: "Company Profile and Commercial Snapshot",
    description: "General company profile, economics, and positioning signals.",
    fields: [
      { name: "company_age", label: "Company Age", type: "text" },
      { name: "organizational_structure", label: "Organizational Structure", type: "text" },
      { name: "revenue_level", label: "Revenue Level", type: "text" },
      { name: "core_competencies", label: "Core Competencies", type: "textarea", rows: 4, colSpan: 2 },
      { name: "facilities_summary", label: "Facilities Summary", type: "textarea", rows: 4, colSpan: 2 },
      { name: "top_three_customers", label: "Top Three Customers", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "behavioral",
    title: "Behavioral and Usage Data",
    description: "Relationship history, channel behavior, engagement, support, and churn signals.",
    fields: [
      { name: "initial_engagement_source", label: "Initial Engagement Source", type: "text" },
      { name: "relationship_summary", label: "Relationship Summary", type: "textarea", rows: 4, colSpan: 2 },
      { name: "product_service_usage_frequency", label: "Product / Service Usage Frequency", type: "text" },
      { name: "feature_usage_details", label: "Feature Usage Details", type: "textarea", rows: 4, colSpan: 2 },
      { name: "channel_preferences", label: "Channel Preferences", type: "text" },
      { name: "engagement_history", label: "Engagement History", type: "textarea", rows: 4, colSpan: 2 },
      { name: "website_behavior", label: "Website Behavior", type: "textarea", rows: 4, colSpan: 2 },
      { name: "support_interactions", label: "Support Interactions", type: "textarea", rows: 4, colSpan: 2 },
      { name: "trial_onboarding_progress", label: "Trial / Onboarding Progress", type: "textarea", rows: 4, colSpan: 2 },
      { name: "renewal_churn_signals", label: "Renewal / Churn Signals", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "financial",
    title: "Transactional and Financial Data",
    description: "Monetary and contract details used for account strategy and health.",
    fields: [
      { name: "clv_estimate", label: "CLV Estimate", type: "number" },
      { name: "average_order_value", label: "Average Order Value", type: "number" },
      { name: "purchase_frequency", label: "Purchase Frequency", type: "text" },
      { name: "last_purchase_date", label: "Last Purchase Date", type: "date" },
      { name: "payment_terms_history", label: "Payment Terms and History", type: "textarea", rows: 4, colSpan: 2 },
      { name: "outstanding_invoices", label: "Outstanding Invoices", type: "textarea", rows: 4, colSpan: 2 },
      { name: "discounts_pricing", label: "Discounts / Negotiated Pricing", type: "textarea", rows: 4, colSpan: 2 },
      { name: "contract_start_date", label: "Contract Start Date", type: "date" },
      { name: "contract_end_date", label: "Contract End Date", type: "date" },
    ],
  },
  {
    key: "technographic",
    title: "Technographic and Systems",
    description: "Current systems, integrations, and security requirements.",
    fields: [
      { name: "primary_software_platforms", label: "Primary Software Platforms", type: "textarea", rows: 4, colSpan: 2 },
      { name: "hardware_equipment", label: "Hardware / Equipment", type: "textarea", rows: 4, colSpan: 2 },
      { name: "integration_points", label: "Integration Points", type: "textarea", rows: 4, colSpan: 2 },
      { name: "it_decision_maker", label: "IT Decision Maker", type: "text" },
      {
        name: "security_compliance_requirements",
        label: "Security / Compliance Requirements",
        type: "textarea",
        rows: 4,
        colSpan: 2,
      },
    ],
  },
  {
    key: "kpis",
    title: "Operational Metrics and KPIs",
    description: "What the customer tracks, where they are, and where they want to go.",
    fields: [
      { name: "customer_kpis", label: "Customer KPIs", type: "textarea", rows: 4, colSpan: 2 },
      { name: "baseline_kpis", label: "Baseline KPIs", type: "textarea", rows: 4, colSpan: 2 },
      { name: "target_kpis", label: "Target KPIs", type: "textarea", rows: 4, colSpan: 2 },
      { name: "operational_cadence", label: "Operational Cadence", type: "text" },
    ],
  },
  {
    key: "psychographics",
    title: "Psychographics, Motivations, and Preferences",
    description: "Goals, motivations, pain, and culture signals.",
    fields: [
      { name: "primary_business_goals", label: "Primary Business Goals", type: "textarea", rows: 4, colSpan: 2 },
      { name: "top_pain_points", label: "Top Pain Points", type: "textarea", rows: 4, colSpan: 2 },
      { name: "buying_motivations", label: "Buying Motivations", type: "textarea", rows: 4, colSpan: 2 },
      { name: "risk_tolerance", label: "Risk Tolerance", type: "text" },
      { name: "values_culture_signals", label: "Values / Culture Signals", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "jtbd",
    title: "Jobs To Be Done and Problem Statements",
    description: "The actual work they need done, their workarounds, triggers, and stakes.",
    fields: [
      { name: "jobs_to_be_done", label: "Jobs To Be Done", type: "textarea", rows: 4, colSpan: 2 },
      { name: "current_workarounds", label: "Current Workarounds", type: "textarea", rows: 4, colSpan: 2 },
      { name: "solution_triggers", label: "Solution Triggers", type: "textarea", rows: 4, colSpan: 2 },
      { name: "consequences_of_failure", label: "Consequences of Failure", type: "textarea", rows: 4, colSpan: 2 },
      { name: "problem_frequency_severity", label: "Problem Frequency / Severity", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "buying-process",
    title: "Decision Making and Procurement Process",
    description: "How the deal actually gets approved and what slows it down.",
    fields: [
      { name: "buying_committee", label: "Buying Committee", type: "textarea", rows: 4, colSpan: 2 },
      { name: "approval_thresholds", label: "Approval Thresholds", type: "textarea", rows: 4, colSpan: 2 },
      { name: "procurement_steps", label: "Procurement Steps", type: "textarea", rows: 4, colSpan: 2 },
      { name: "preferred_vendors_rules", label: "Preferred Vendors / Procurement Rules", type: "textarea", rows: 4, colSpan: 2 },
      { name: "objections_negotiation_levers", label: "Objections / Negotiation Levers", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "support-history",
    title: "Support, Relationship, and Service History",
    description: "Ongoing account history, onboarding, support, satisfaction, and renewal activity.",
    fields: [
      { name: "internal_account_owner", label: "Internal Account Owner", type: "text" },
      { name: "onboarding_notes", label: "Onboarding Notes", type: "textarea", rows: 4, colSpan: 2 },
      { name: "support_ticket_history", label: "Support Ticket History", type: "textarea", rows: 4, colSpan: 2 },
      { name: "sla_commitments_breaches", label: "SLA Commitments / Breaches", type: "textarea", rows: 4, colSpan: 2 },
      { name: "csat_nps", label: "CSAT / NPS", type: "text" },
      { name: "renewal_conversations", label: "Renewal Conversations", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "legal-risk",
    title: "Legal, Compliance, and Risk",
    description: "Contractual, regulatory, privacy, and export-risk items.",
    fields: [
      { name: "contract_clauses_of_note", label: "Contract Clauses of Note", type: "textarea", rows: 4, colSpan: 2 },
      { name: "regulatory_constraints", label: "Regulatory Constraints", type: "textarea", rows: 4, colSpan: 2 },
      { name: "insurance_requirements", label: "Insurance / Indemnity Requirements", type: "textarea", rows: 4, colSpan: 2 },
      { name: "privacy_constraints", label: "Privacy Constraints", type: "textarea", rows: 4, colSpan: 2 },
      { name: "export_controls_flags", label: "Export Controls / Restricted Goods Flags", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "segmentation",
    title: "Signals, Tags, and Segmentation",
    description: "How this account should be bucketed and prioritized inside Freshware.",
    fields: [
      { name: "customer_segment", label: "Customer Segment", type: "text" },
      { name: "lifecycle_stage", label: "Lifecycle Stage", type: "text" },
      { name: "priority_level", label: "Priority Level", type: "text" },
      { name: "custom_tags", label: "Custom Tags", type: "textarea", rows: 4, colSpan: 2 },
    ],
  },
  {
    key: "evidence",
    title: "Qualitative Evidence and Artifacts",
    description: "Quotes, case studies, and feature request intelligence.",
    fields: [
      { name: "interview_transcripts_quotes", label: "Interview Transcripts / Quotes", type: "textarea", rows: 5, colSpan: 2 },
      { name: "case_studies", label: "Case Studies / Success Stories", type: "textarea", rows: 5, colSpan: 2 },
      { name: "feedback_feature_requests", label: "Feedback / Feature Requests", type: "textarea", rows: 5, colSpan: 2 },
    ],
  },
];

function normalizeDateValue(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeJsonField(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function buildInitialState(company: Company): FormState {
  return {
    name: company.name ?? "",
    legal_name: company.legal_name ?? "",
    website: company.website ?? "",
    linkedin_url: company.linkedin_url ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    mailing_address: company.mailing_address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    postal_code: company.postal_code ?? "",
    country: company.country ?? "",
    preferred_contact_method: company.preferred_contact_method ?? "",
    primary_contact_name: company.primary_contact_name ?? "",
    primary_contact_role: company.primary_contact_role ?? "",
    primary_contact_email: company.primary_contact_email ?? "",
    primary_contact_phone: company.primary_contact_phone ?? "",
    secondary_contacts: normalizeJsonField(company.secondary_contacts),

    industry: company.industry ?? "",
    industry_code: company.industry_code ?? "",
    company_size: company.company_size ?? "",
    employee_count_range: company.employee_count_range ?? "",
    revenue_band: company.revenue_band ?? "",
    headquarters_location: company.headquarters_location ?? "",
    legal_entity: company.legal_entity ?? "",
    tax_id: company.tax_id ?? "",
    business_model: company.business_model ?? "",
    ownership_type: company.ownership_type ?? "",
    key_decision_makers: company.key_decision_makers ?? "",
    org_chart_notes: company.org_chart_notes ?? "",
    procurement_cycle_days: company.procurement_cycle_days ?? "",
    contracting_billing_preferences: company.contracting_billing_preferences ?? "",

    company_age: company.company_age ?? "",
    organizational_structure: company.organizational_structure ?? "",
    revenue_level: company.revenue_level ?? "",
    core_competencies: company.core_competencies ?? "",
    facilities_summary: company.facilities_summary ?? "",
    top_three_customers: company.top_three_customers ?? "",

    initial_engagement_source: company.initial_engagement_source ?? "",
    relationship_summary: company.relationship_summary ?? "",
    product_service_usage_frequency: company.product_service_usage_frequency ?? "",
    feature_usage_details: company.feature_usage_details ?? "",
    channel_preferences: company.channel_preferences ?? "",
    engagement_history: company.engagement_history ?? "",
    website_behavior: company.website_behavior ?? "",
    support_interactions: company.support_interactions ?? "",
    trial_onboarding_progress: company.trial_onboarding_progress ?? "",
    renewal_churn_signals: company.renewal_churn_signals ?? "",

    clv_estimate: company.clv_estimate ?? "",
    average_order_value: company.average_order_value ?? "",
    purchase_frequency: company.purchase_frequency ?? "",
    last_purchase_date: normalizeDateValue(company.last_purchase_date),
    payment_terms_history: company.payment_terms_history ?? "",
    outstanding_invoices: company.outstanding_invoices ?? "",
    discounts_pricing: company.discounts_pricing ?? "",
    contract_start_date: normalizeDateValue(company.contract_start_date),
    contract_end_date: normalizeDateValue(company.contract_end_date),

    primary_software_platforms: company.primary_software_platforms ?? "",
    hardware_equipment: company.hardware_equipment ?? "",
    integration_points: company.integration_points ?? "",
    it_decision_maker: company.it_decision_maker ?? "",
    security_compliance_requirements: company.security_compliance_requirements ?? "",

    customer_kpis: company.customer_kpis ?? "",
    baseline_kpis: company.baseline_kpis ?? "",
    target_kpis: company.target_kpis ?? "",
    operational_cadence: company.operational_cadence ?? "",

    primary_business_goals: company.primary_business_goals ?? "",
    top_pain_points: company.top_pain_points ?? "",
    buying_motivations: company.buying_motivations ?? "",
    risk_tolerance: company.risk_tolerance ?? "",
    values_culture_signals: company.values_culture_signals ?? "",

    jobs_to_be_done: company.jobs_to_be_done ?? "",
    current_workarounds: company.current_workarounds ?? "",
    solution_triggers: company.solution_triggers ?? "",
    consequences_of_failure: company.consequences_of_failure ?? "",
    problem_frequency_severity: company.problem_frequency_severity ?? "",

    buying_committee: company.buying_committee ?? "",
    approval_thresholds: company.approval_thresholds ?? "",
    procurement_steps: company.procurement_steps ?? "",
    preferred_vendors_rules: company.preferred_vendors_rules ?? "",
    objections_negotiation_levers: company.objections_negotiation_levers ?? "",

    internal_account_owner: company.internal_account_owner ?? "",
    onboarding_notes: company.onboarding_notes ?? "",
    support_ticket_history: company.support_ticket_history ?? "",
    sla_commitments_breaches: company.sla_commitments_breaches ?? "",
    csat_nps: company.csat_nps ?? "",
    renewal_conversations: company.renewal_conversations ?? "",

    contract_clauses_of_note: company.contract_clauses_of_note ?? "",
    regulatory_constraints: company.regulatory_constraints ?? "",
    insurance_requirements: company.insurance_requirements ?? "",
    privacy_constraints: company.privacy_constraints ?? "",
    export_controls_flags: company.export_controls_flags ?? "",

    customer_segment: company.customer_segment ?? "",
    lifecycle_stage: company.lifecycle_stage ?? "",
    priority_level: company.priority_level ?? "",
    custom_tags: company.custom_tags ?? "",

    interview_transcripts_quotes: company.interview_transcripts_quotes ?? "",
    case_studies: company.case_studies ?? "",
    feedback_feature_requests: company.feedback_feature_requests ?? "",
  };
}

function parseNullableNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseNullableInteger(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function parseNullableDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function parseSecondaryContacts(value: string): any {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

function fieldInputId(companyId: string, fieldName: string) {
  return `company-${companyId}-${fieldName}`;
}

function getFieldValue(form: FormState, name: string) {
  const value = form[name];
  return value == null ? "" : value;
}

export default function EditCompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialState(company));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((section) => [section.key, true]))
  );

  const originalState = useMemo<FormState>(() => buildInitialState(company), [company]);

  const dirtyCount = useMemo(() => {
    return Object.keys(form).reduce((count, key) => {
      return originalState[key] !== form[key] ? count + 1 : count;
    }, 0);
  }, [form, originalState]);

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "secondary_contacts") setJsonError("");
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setJsonError("");

    let secondaryContacts: any = null;

    try {
      secondaryContacts = parseSecondaryContacts(String(form.secondary_contacts ?? ""));
    } catch {
      setJsonError("Secondary Contacts must be valid JSON before saving.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name || null,
      legal_name: form.legal_name || null,
      website: form.website || null,
      linkedin_url: form.linkedin_url || null,
      email: form.email || null,
      phone: form.phone || null,
      mailing_address: form.mailing_address || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postal_code || null,
      country: form.country || null,
      preferred_contact_method: form.preferred_contact_method || null,
      primary_contact_name: form.primary_contact_name || null,
      primary_contact_role: form.primary_contact_role || null,
      primary_contact_email: form.primary_contact_email || null,
      primary_contact_phone: form.primary_contact_phone || null,
      secondary_contacts: secondaryContacts,

      industry: form.industry || null,
      industry_code: form.industry_code || null,
      company_size: form.company_size || null,
      employee_count_range: form.employee_count_range || null,
      revenue_band: form.revenue_band || null,
      headquarters_location: form.headquarters_location || null,
      legal_entity: form.legal_entity || null,
      tax_id: form.tax_id || null,
      business_model: form.business_model || null,
      ownership_type: form.ownership_type || null,
      key_decision_makers: form.key_decision_makers || null,
      org_chart_notes: form.org_chart_notes || null,
      procurement_cycle_days: parseNullableInteger(form.procurement_cycle_days),
      contracting_billing_preferences: form.contracting_billing_preferences || null,

      company_age: form.company_age || null,
      organizational_structure: form.organizational_structure || null,
      revenue_level: form.revenue_level || null,
      core_competencies: form.core_competencies || null,
      facilities_summary: form.facilities_summary || null,
      top_three_customers: form.top_three_customers || null,

      initial_engagement_source: form.initial_engagement_source || null,
      relationship_summary: form.relationship_summary || null,
      product_service_usage_frequency: form.product_service_usage_frequency || null,
      feature_usage_details: form.feature_usage_details || null,
      channel_preferences: form.channel_preferences || null,
      engagement_history: form.engagement_history || null,
      website_behavior: form.website_behavior || null,
      support_interactions: form.support_interactions || null,
      trial_onboarding_progress: form.trial_onboarding_progress || null,
      renewal_churn_signals: form.renewal_churn_signals || null,

      clv_estimate: parseNullableNumber(form.clv_estimate),
      average_order_value: parseNullableNumber(form.average_order_value),
      purchase_frequency: form.purchase_frequency || null,
      last_purchase_date: parseNullableDate(form.last_purchase_date),
      payment_terms_history: form.payment_terms_history || null,
      outstanding_invoices: form.outstanding_invoices || null,
      discounts_pricing: form.discounts_pricing || null,
      contract_start_date: parseNullableDate(form.contract_start_date),
      contract_end_date: parseNullableDate(form.contract_end_date),

      primary_software_platforms: form.primary_software_platforms || null,
      hardware_equipment: form.hardware_equipment || null,
      integration_points: form.integration_points || null,
      it_decision_maker: form.it_decision_maker || null,
      security_compliance_requirements: form.security_compliance_requirements || null,

      customer_kpis: form.customer_kpis || null,
      baseline_kpis: form.baseline_kpis || null,
      target_kpis: form.target_kpis || null,
      operational_cadence: form.operational_cadence || null,

      primary_business_goals: form.primary_business_goals || null,
      top_pain_points: form.top_pain_points || null,
      buying_motivations: form.buying_motivations || null,
      risk_tolerance: form.risk_tolerance || null,
      values_culture_signals: form.values_culture_signals || null,

      jobs_to_be_done: form.jobs_to_be_done || null,
      current_workarounds: form.current_workarounds || null,
      solution_triggers: form.solution_triggers || null,
      consequences_of_failure: form.consequences_of_failure || null,
      problem_frequency_severity: form.problem_frequency_severity || null,

      buying_committee: form.buying_committee || null,
      approval_thresholds: form.approval_thresholds || null,
      procurement_steps: form.procurement_steps || null,
      preferred_vendors_rules: form.preferred_vendors_rules || null,
      objections_negotiation_levers: form.objections_negotiation_levers || null,

      internal_account_owner: form.internal_account_owner || null,
      onboarding_notes: form.onboarding_notes || null,
      support_ticket_history: form.support_ticket_history || null,
      sla_commitments_breaches: form.sla_commitments_breaches || null,
      csat_nps: form.csat_nps || null,
      renewal_conversations: form.renewal_conversations || null,

      contract_clauses_of_note: form.contract_clauses_of_note || null,
      regulatory_constraints: form.regulatory_constraints || null,
      insurance_requirements: form.insurance_requirements || null,
      privacy_constraints: form.privacy_constraints || null,
      export_controls_flags: form.export_controls_flags || null,

      customer_segment: form.customer_segment || null,
      lifecycle_stage: form.lifecycle_stage || null,
      priority_level: form.priority_level || null,
      custom_tags: form.custom_tags || null,

      interview_transcripts_quotes: form.interview_transcripts_quotes || null,
      case_studies: form.case_studies || null,
      feedback_feature_requests: form.feedback_feature_requests || null,
    };

    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save company");
      }

      router.push(`/dashboard/companies/${company.id}`);
      router.refresh();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm(buildInitialState(company));
    setSaveError("");
    setJsonError("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Company 360</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Edit Company</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Update every company profile field manually so your team is never blocked if AI cannot generate
              enough information. These fields are the real source-of-truth for the company profile.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/companies/${company.id}`}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Back to Company 360
            </Link>
            <Link
              href="/dashboard/companies"
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Back to Companies
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Reset Changes
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Company"}
            </button>
          </div>
        </div>

        <div className="border-t bg-gray-50/60 px-6 py-4 text-sm text-gray-600">
          {dirtyCount ? `${dirtyCount} unsaved field change${dirtyCount === 1 ? "" : "s"}` : "No unsaved changes"}
        </div>
      </section>

      {saveError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{saveError}</div>
      ) : null}

      {jsonError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{jsonError}</div>
      ) : null}

      {SECTIONS.map((section) => {
        const isOpen = openSections[section.key] ?? true;

        return (
          <section key={section.key} className="rounded-3xl border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              className="flex w-full items-center justify-between px-6 py-5 text-left"
            >
              <div>
                <div className="text-lg font-semibold text-gray-900">{section.title}</div>
                {section.description ? (
                  <div className="mt-1 text-sm text-gray-500">{section.description}</div>
                ) : null}
              </div>
              <div className="text-sm font-semibold text-gray-500">{isOpen ? "Hide" : "Show"}</div>
            </button>

            {isOpen ? (
              <div className="border-t px-6 py-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {section.fields.map((field) => {
                    const id = fieldInputId(company.id, field.name);
                    const value = getFieldValue(form, field.name);
                    const colSpanClass = field.colSpan === 2 ? "md:col-span-2" : "";

                    return (
                      <div key={field.name} className={colSpanClass}>
                        <label htmlFor={id} className="mb-2 block text-sm font-semibold text-gray-900">
                          {field.label}
                        </label>

                        {field.type === "textarea" ? (
                          <textarea
                            id={id}
                            value={value}
                            rows={field.rows || 4}
                            onChange={(e) => updateField(field.name, e.target.value)}
                            className="min-h-[110px] w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                            placeholder={field.placeholder || field.label}
                          />
                        ) : (
                          <input
                            id={id}
                            type={field.type || "text"}
                            value={value}
                            onChange={(e) => updateField(field.name, e.target.value)}
                            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                            placeholder={field.placeholder || field.label}
                            step={field.type === "number" ? "any" : undefined}
                          />
                        )}

                        {field.helpText ? (
                          <div className="mt-2 text-xs text-gray-500">{field.helpText}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Save Company Profile</div>
            <div className="mt-1 text-sm text-gray-500">
              This saves the manual source-of-truth profile. AI can still generate insights separately.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/companies/${company.id}`}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Company"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}