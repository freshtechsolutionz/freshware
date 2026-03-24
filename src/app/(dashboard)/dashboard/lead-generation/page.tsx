import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import LeadGenerationClient from "@/components/leads/LeadGenerationClient";

export const runtime = "nodejs";

export default async function LeadGenerationPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/lead-generation");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Lead Generation</div>
        <div className="mt-2 text-sm text-gray-600">Missing profile or account assignment.</div>
      </div>
    );
  }

  const accountId = profile.account_id;

  const [leadsRes, companiesRes] = await Promise.all([
    supabase
      .from("lead_prospects")
      .select("*")
      .eq("account_id", accountId)
      .order("total_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),

    supabase
      .from("companies")
      .select("id, name, industry, customer_segment, lifecycle_stage")
      .eq("account_id", accountId)
      .order("name", { ascending: true }),
  ]);

  if (leadsRes.error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Lead Generation</div>
        <div className="mt-2 text-sm text-red-600">{leadsRes.error.message}</div>
      </div>
    );
  }

  if (companiesRes.error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Lead Generation</div>
        <div className="mt-2 text-sm text-red-600">{companiesRes.error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Generation"
        subtitle="Generate, score, qualify, and convert lead prospects into company profiles and opportunities."
        right={
          <div className="flex flex-wrap gap-2">
            <a href="/dashboard/companies" className="fw-btn text-sm">
              Company Profiles
            </a>
            <a href="/dashboard" className="fw-btn text-sm">
              Back to Dashboard
            </a>
          </div>
        }
      />

      <LeadGenerationClient
        leads={(leadsRes.data || []) as any[]}
        companies={(companiesRes.data || []) as any[]}
      />
    </div>
  );
}