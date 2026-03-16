import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";

export const runtime = "nodejs";

function money(n: number | null | undefined) {
  const v = Number(n || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function pretty(v: string | null | undefined) {
  if (!v) return "N/A";
  return v;
}

function chipClass(value: string | null | undefined, kind: "priority" | "lifecycle") {
  const v = String(value || "").toUpperCase();

  if (kind === "priority") {
    if (v === "HIGH") return "border-red-200 bg-red-50 text-red-700";
    if (v === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
    if (v === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-gray-200 bg-gray-50 text-gray-700";
  }

  if (v.includes("CUSTOMER")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (v.includes("PROSPECT")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (v.includes("LEAD")) return "border-violet-200 bg-violet-50 text-violet-700";
  if (v.includes("CHURN")) return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

type CompanyRow = {
  id: string;
  name: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  customer_segment: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  primary_business_goals: string | null;
  top_pain_points: string | null;
  internal_account_owner: string | null;
};

export default async function CompaniesIndexPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/companies");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Company Profiles</div>
        <div className="mt-2 text-sm text-gray-600">Missing profile or account assignment.</div>
      </div>
    );
  }

  const accountId = profile.account_id;

  const { data: companiesRaw, error } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      website,
      industry,
      city,
      state,
      customer_segment,
      lifecycle_stage,
      priority_level,
      primary_business_goals,
      top_pain_points,
      internal_account_owner
    `)
    .eq("account_id", accountId)
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Company Profiles</div>
        <div className="mt-2 text-sm text-red-600">{error.message}</div>
      </div>
    );
  }

  const companies = (companiesRaw || []) as CompanyRow[];
  const companyIds = companies.map((c) => c.id);

  let contactCounts: Record<string, number> = {};
  let oppMetrics: Record<string, { open: number; pipeline: number; won: number }> = {};
  let projectMetrics: Record<string, { total: number; active: number; support: number }> = {};
  let intelligenceMap: Record<string, { summary: string | null; updated_at?: string | null }> = {};

  if (companyIds.length) {
    const [contactsRes, oppRes, projectRes, intelRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, company_id")
        .eq("account_id", accountId)
        .in("company_id", companyIds),

      supabase
        .from("opportunities")
        .select("id, company_id, amount, stage")
        .eq("account_id", accountId)
        .in("company_id", companyIds),

      supabase
        .from("projects")
        .select("id, company_id, status, support_monthly_cost")
        .eq("account_id", accountId)
        .in("company_id", companyIds),

      supabase
        .from("company_intelligence")
        .select("company_id, summary, updated_at")
        .eq("account_id", accountId)
        .in("company_id", companyIds)
        .order("updated_at", { ascending: false }),
    ]);

    for (const row of (contactsRes.data || []) as any[]) {
      const key = row.company_id;
      contactCounts[key] = (contactCounts[key] || 0) + 1;
    }

    for (const row of (oppRes.data || []) as any[]) {
      const key = row.company_id;
      if (!oppMetrics[key]) oppMetrics[key] = { open: 0, pipeline: 0, won: 0 };

      const stage = String(row.stage || "").toLowerCase();
      const amount = Number(row.amount || 0);

      if (stage !== "won" && stage !== "lost") {
        oppMetrics[key].open += 1;
        oppMetrics[key].pipeline += amount;
      }
      if (stage === "won") {
        oppMetrics[key].won += amount;
      }
    }

    for (const row of (projectRes.data || []) as any[]) {
      const key = row.company_id;
      if (!projectMetrics[key]) projectMetrics[key] = { total: 0, active: 0, support: 0 };

      const status = String(row.status || "").toLowerCase();
      projectMetrics[key].total += 1;
      if (!["done", "closed", "completed", "cancelled", "canceled"].includes(status)) {
        projectMetrics[key].active += 1;
      }
      projectMetrics[key].support += Number(row.support_monthly_cost || 0);
    }

    for (const row of (intelRes.data || []) as any[]) {
      if (!intelligenceMap[row.company_id]) {
        intelligenceMap[row.company_id] = {
          summary: row.summary || null,
          updated_at: row.updated_at || null,
        };
      }
    }
  }

  const totalPipeline = Object.values(oppMetrics).reduce((sum, x) => sum + (x.pipeline || 0), 0);
  const totalWon = Object.values(oppMetrics).reduce((sum, x) => sum + (x.won || 0), 0);
  const totalSupport = Object.values(projectMetrics).reduce((sum, x) => sum + (x.support || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profiles"
        subtitle="CEO-friendly customer intelligence across companies, pipeline, projects, and support revenue."
        right={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="fw-btn text-sm">
              Back to Dashboard
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="fw-card-strong p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Companies</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{companies.length}</div>
          <div className="mt-2 text-sm text-gray-600">Tracked company profiles</div>
        </div>

        <div className="fw-card-strong p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Open Pipeline</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{money(totalPipeline)}</div>
          <div className="mt-2 text-sm text-gray-600">Open opportunities tied to companies</div>
        </div>

        <div className="fw-card-strong p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Won Revenue</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{money(totalWon)}</div>
          <div className="mt-2 text-sm text-gray-600">Closed-won opportunity value</div>
        </div>

        <div className="fw-card-strong p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Support MRR</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{money(totalSupport)}</div>
          <div className="mt-2 text-sm text-gray-600">Monthly support across linked projects</div>
        </div>
      </section>

      <section className="fw-card-strong p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Company Intelligence Index</div>
            <div className="mt-1 text-sm text-gray-600">
              Start with the highest-value CEO fields first. Drill into each company for the full 360.
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3">Company</th>
                <th className="px-3">Segment</th>
                <th className="px-3">Lifecycle</th>
                <th className="px-3">Priority</th>
                <th className="px-3">Contacts</th>
                <th className="px-3">Open Pipeline</th>
                <th className="px-3">Projects</th>
                <th className="px-3">Support MRR</th>
                <th className="px-3">Owner</th>
                <th className="px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const opp = oppMetrics[company.id] || { open: 0, pipeline: 0, won: 0 };
                const proj = projectMetrics[company.id] || { total: 0, active: 0, support: 0 };
                const contacts = contactCounts[company.id] || 0;
                const intel = intelligenceMap[company.id];

                return (
                  <tr key={company.id} className="bg-white shadow-sm">
                    <td className="rounded-l-2xl border-y border-l px-3 py-4 align-top">
                      <div className="min-w-[220px]">
                        <Link
                          href={`/dashboard/companies/${company.id}`}
                          className="text-sm font-semibold text-gray-900 underline underline-offset-4"
                        >
                          {company.name || "Unnamed Company"}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">
                          {pretty(company.industry)} • {pretty([company.city, company.state].filter(Boolean).join(", "))}
                        </div>
                        {company.website ? (
                          <div className="mt-1 text-xs text-blue-700">{company.website}</div>
                        ) : null}
                        {intel?.summary ? (
                          <div className="mt-2 line-clamp-3 text-xs text-gray-600">
                            {intel.summary}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="border-y px-3 py-4 text-sm text-gray-700">{pretty(company.customer_segment)}</td>

                    <td className="border-y px-3 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass(company.lifecycle_stage, "lifecycle")}`}>
                        {pretty(company.lifecycle_stage)}
                      </span>
                    </td>

                    <td className="border-y px-3 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass(company.priority_level, "priority")}`}>
                        {pretty(company.priority_level)}
                      </span>
                    </td>

                    <td className="border-y px-3 py-4 text-sm text-gray-700">{contacts}</td>

                    <td className="border-y px-3 py-4">
                      <div className="text-sm font-semibold text-gray-900">{money(opp.pipeline)}</div>
                      <div className="text-xs text-gray-500">{opp.open} open</div>
                    </td>

                    <td className="border-y px-3 py-4">
                      <div className="text-sm font-semibold text-gray-900">{proj.total}</div>
                      <div className="text-xs text-gray-500">{proj.active} active</div>
                    </td>

                    <td className="border-y px-3 py-4 text-sm font-semibold text-gray-900">
                      {money(proj.support)}
                    </td>

                    <td className="border-y px-3 py-4 text-sm text-gray-700">
                      {pretty(company.internal_account_owner)}
                    </td>

                    <td className="rounded-r-2xl border-y border-r px-3 py-4">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/dashboard/companies/${company.id}`}
                          className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                        >
                          Open 360
                        </Link>

                        <form action={`/api/companies/${company.id}/generate-info`} method="post">
                          <button
                            type="submit"
                            className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                          >
                            Generate Company Info
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!companies.length ? (
            <div className="mt-4 text-sm text-gray-600">No company profiles yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}