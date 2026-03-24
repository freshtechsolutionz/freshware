import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import Company360Client from "@/components/companies/Company360Client";

export const runtime = "nodejs";

export default async function Company360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/companies/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Company 360</div>
        <div className="mt-2 text-sm text-gray-600">Missing profile or account assignment.</div>
      </div>
    );
  }

  const accountId = profile.account_id;

  const [
    companyRes,
    contactsRes,
    oppRes,
    projectRes,
    revenueRes,
    allContactsRes,
    allOppsRes,
    allProjectsRes,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("*")
      .eq("id", id)
      .eq("account_id", accountId)
      .maybeSingle(),

    supabase
      .from("contacts")
      .select("id, name, email, phone, title, company_id")
      .eq("account_id", accountId)
      .eq("company_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("opportunities")
      .select("id, name, stage, amount, service_line, company_id")
      .eq("account_id", accountId)
      .eq("company_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("projects")
      .select("id, name, status, stage, support_monthly_cost, company_id")
      .eq("account_id", accountId)
      .eq("company_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("revenue_entries")
      .select("id, title, amount, revenue_type, status, recognized_on, frequency")
      .eq("account_id", accountId)
      .eq("company_id", id)
      .order("recognized_on", { ascending: false, nullsFirst: false }),

    supabase
      .from("contacts")
      .select("id, name, email, phone, title, company_id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),

    supabase
      .from("opportunities")
      .select("id, name, stage, amount, service_line, company_id")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("projects")
      .select("id, name, status, stage, support_monthly_cost, company_id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
  ]);

  if (companyRes.error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Company 360</div>
        <div className="mt-2 text-sm text-red-600">{companyRes.error.message}</div>
      </div>
    );
  }

  if (!companyRes.data) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company 360"
        subtitle="Sales, delivery, revenue, intelligence, and linking in one place."
      />

      <Company360Client
        company={companyRes.data}
        contacts={(contactsRes.data || []) as any}
        opportunities={(oppRes.data || []) as any}
        projects={(projectRes.data || []) as any}
        revenue={(revenueRes.data || []) as any}
        availableContacts={(allContactsRes.data || []) as any}
        availableOpportunities={(allOppsRes.data || []) as any}
        availableProjects={(allProjectsRes.data || []) as any}
      />
    </div>
  );
}