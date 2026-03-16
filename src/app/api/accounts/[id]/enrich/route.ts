import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

const TEXT_FIELDS = [
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
  "competitive_comparisons",
  "site_visit_notes",
  "data_sources",
  "verification_status",
  "privacy_classification",
  "process_maps_notes",
  "feature_priority_scores",
  "ai_summary",
  "status",
] as const;

const DATE_FIELDS = [
  "last_purchase_date",
  "contract_start_date",
  "contract_end_date",
] as const;

const NUMERIC_FIELDS = [
  "procurement_cycle_days",
  "clv_estimate",
  "average_order_value",
  "estimated_annual_cost_of_problem",
  "churn_propensity_score",
  "integration_readiness_score",
] as const;

function dateOrNull(v: any) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function numberOrNull(v: any) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  return NextResponse.json({ company: data }, { status: 200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, any> = {};

  for (const field of TEXT_FIELDS) {
    if (field in body) {
      patch[field] = body[field] === null || body[field] === undefined ? null : String(body[field]).trim() || null;
    }
  }

  for (const field of DATE_FIELDS) {
    if (field in body) patch[field] = dateOrNull(body[field]);
  }

  for (const field of NUMERIC_FIELDS) {
    if (field in body) patch[field] = numberOrNull(body[field]);
  }

  if ("secondary_contacts" in body) {
    patch.secondary_contacts =
      body.secondary_contacts && typeof body.secondary_contacts === "object"
        ? body.secondary_contacts
        : null;
  }

  if (!("name" in patch) && !(body?.name || "").trim()) {
    // allow partial updates without requiring name every time
  } else if ("name" in patch && !patch.name) {
    return NextResponse.json({ error: "Company name cannot be blank." }, { status: 400 });
  }

  patch.critical_fields_updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ company: data }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const [contactsRes, oppsRes, projectsRes] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", profile.account_id).eq("company_id", id),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("account_id", profile.account_id).eq("company_id", id).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("account_id", profile.account_id).eq("company_id", id),
  ]);

  const linked =
    Number(contactsRes.count || 0) + Number(oppsRes.count || 0) + Number(projectsRes.count || 0);

  if (linked > 0) {
    return NextResponse.json(
      { error: "Cannot delete company while linked contacts, opportunities, or projects still reference it." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .eq("account_id", profile.account_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}