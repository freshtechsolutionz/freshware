import PageHeader from "@/components/dashboard/PageHeader";
import EditAccountForm from "./EditAccountForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const runtime = "nodejs";

type Company = {
  id: string;
  account_id: string;
  name: string | null;
  legal_name: string | null;
  website: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  preferred_contact_method: string | null;
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  industry: string | null;
  company_size: string | null;
  employee_count_range: string | null;
  revenue_band: string | null;
  business_model: string | null;
  ownership_type: string | null;
  procurement_cycle_days: number | null;
  company_age: string | null;
  organizational_structure: string | null;
  revenue_level: string | null;
  core_competencies: string | null;
  initial_engagement_source: string | null;
  relationship_summary: string | null;
  primary_business_goals: string | null;
  top_pain_points: string | null;
  buying_motivations: string | null;
  risk_tolerance: string | null;
  values_culture_signals: string | null;
  primary_software_platforms: string | null;
  integration_points: string | null;
  it_decision_maker: string | null;
  security_compliance_requirements: string | null;
  customer_segment: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  buying_committee: string | null;
  approval_thresholds: string | null;
  procurement_steps: string | null;
  preferred_vendors_rules: string | null;
  objections_negotiation_levers: string | null;
  support_interactions: string | null;
  renewal_churn_signals: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  ai_summary: string | null;
  ai_last_enriched_at: string | null;
  custom_tags: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MiniContact = {
  id: string;
  name: string | null;
  email: string | null;
  title: string | null;
};

type MiniOpportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
};

type MiniProject = {
  id: string;
  name: string | null;
  status: string | null;
  health: string | null;
  progress_percent: number | null;
};

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/accounts/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <>
        <PageHeader
          title="Company Profile"
          subtitle="Missing account assignment."
          right={
            <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
              Back to Company Profiles
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Your profile is missing account_id.
        </div>
      </>
    );
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHeader
          title="Company Profile"
          subtitle="Unable to load company."
          right={
            <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
              Back to Company Profiles
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading company: {error.message}
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader
          title="Company Profile Not Found"
          subtitle="This company may have been deleted."
          right={
            <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
              Back to Company Profiles
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          No record found for id: {id}
        </div>
      </>
    );
  }

  const [contactsRes, oppsRes, projectsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,name,email,title")
      .eq("account_id", profile.account_id)
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("opportunities")
      .select("id,name,stage,amount")
      .eq("account_id", profile.account_id)
      .eq("company_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("projects")
      .select("id,name,status,health,progress_percent")
      .eq("account_id", profile.account_id)
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return (
    <EditAccountForm
      initial={data as Company}
      initialContacts={(contactsRes.data || []) as MiniContact[]}
      initialOpportunities={(oppsRes.data || []) as MiniOpportunity[]}
      initialProjects={(projectsRes.data || []) as MiniProject[]}
    />
  );
}