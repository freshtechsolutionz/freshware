import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function parseNullableString(v: any) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function parseNullableNumber(v: any) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNullableDate(v: any) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return String(v).slice(0, 10);
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const { id } = await context.params;

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  return NextResponse.json({ company: data }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const { data: existing, error: existingErr } = await supabase
    .from("companies")
    .select("id")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const patch: Record<string, any> = {};

  const stringFields = [
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
  ];

  for (const field of stringFields) {
    if (field in body) patch[field] = parseNullableString(body[field]);
  }

  const numberFields = [
    "procurement_cycle_days",
    "clv_estimate",
    "average_order_value",
  ];

  for (const field of numberFields) {
    if (field in body) patch[field] = parseNullableNumber(body[field]);
  }

  const dateFields = [
    "last_purchase_date",
    "contract_start_date",
    "contract_end_date",
  ];

  for (const field of dateFields) {
    if (field in body) patch[field] = parseNullableDate(body[field]);
  }

  if ("secondary_contacts" in body) {
    const raw = body.secondary_contacts;
    if (raw === null || raw === "") {
      patch.secondary_contacts = null;
    } else if (typeof raw === "object") {
      patch.secondary_contacts = raw;
    } else {
      try {
        patch.secondary_contacts = JSON.parse(String(raw));
      } catch {
        patch.secondary_contacts = raw;
      }
    }
  }

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

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const roleUpper = String(profile.role || "").toUpperCase();
  const isAdmin = roleUpper === "CEO" || roleUpper === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await context.params;

  const { data: existing, error: existingErr } = await supabase
    .from("companies")
    .select("id")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const [contactUnlink, oppUnlink, projectUnlink, revenueUnlink, intelDelete, companyDelete] = await Promise.all([
    supabase.from("contacts").update({ company_id: null }).eq("account_id", profile.account_id).eq("company_id", id),
    supabase.from("opportunities").update({ company_id: null }).eq("account_id", profile.account_id).eq("company_id", id),
    supabase.from("projects").update({ company_id: null }).eq("account_id", profile.account_id).eq("company_id", id),
    supabase.from("revenue_entries").update({ company_id: null }).eq("account_id", profile.account_id).eq("company_id", id),
    supabase.from("company_intelligence").delete().eq("account_id", profile.account_id).eq("company_id", id),
    supabase.from("companies").delete().eq("account_id", profile.account_id).eq("id", id),
  ]);

  const firstError =
    contactUnlink.error ||
    oppUnlink.error ||
    projectUnlink.error ||
    revenueUnlink.error ||
    intelDelete.error ||
    companyDelete.error;

  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}