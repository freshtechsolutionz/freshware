import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";

export const runtime = "nodejs";

type CompanyRow = Record<string, any>;
type ContactRow = Record<string, any>;
type OpportunityRow = Record<string, any>;
type ProjectRow = Record<string, any>;

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

function chipClass(value: string | null | undefined, kind: "lifecycle" | "priority") {
  const v = String(value || "").toLowerCase();

  if (kind === "lifecycle") {
    if (v.includes("customer")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (v.includes("proposal") || v.includes("negotiation")) return "border-blue-200 bg-blue-50 text-blue-700";
    if (v.includes("lead") || v.includes("prospect")) return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-gray-200 bg-gray-50 text-gray-700";
  }

  if (v.includes("high") || v.includes("urgent")) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (v.includes("medium")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (v.includes("low")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

function normalizeName(v: string | null | undefined) {
  return String(v || "").trim().toLowerCase();
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = ((await searchParams) || {}) as Record<string, string | string[] | undefined>;

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
  const canEdit = ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(
    String(profile.role || "").toUpperCase()
  );

  const [companiesRes, contactsRes, oppsRes, projectsRes] = await Promise.all([
    supabase.from("companies").select("*").eq("account_id", accountId).order("name", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, name, email, company_id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select("id, name, amount, stage, company_id")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, status, support_monthly_cost, company_id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
  ]);

  if (companiesRes.error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Company Profiles</div>
        <div className="mt-2 text-sm text-red-600">{companiesRes.error.message}</div>
      </div>
    );
  }

  const companies = (companiesRes.data || []) as CompanyRow[];
  const contacts = (contactsRes.data || []) as ContactRow[];
  const opps = (oppsRes.data || []) as OpportunityRow[];
  const projects = (projectsRes.data || []) as ProjectRow[];

  const contactMetrics: Record<string, number> = {};
  const oppMetrics: Record<string, { open: number; pipeline: number; won: number }> = {};
  const projectMetrics: Record<string, { total: number; active: number; support: number }> = {};

  for (const company of companies) {
    const key = company.id;
    contactMetrics[key] = 0;
    oppMetrics[key] = { open: 0, pipeline: 0, won: 0 };
    projectMetrics[key] = { total: 0, active: 0, support: 0 };
  }

  for (const row of contacts) {
    const key = row.company_id || "";
    if (key && key in contactMetrics) contactMetrics[key] += 1;
  }

  for (const row of opps) {
    const key = row.company_id || "";
    if (key && key in oppMetrics) {
      const stage = String(row.stage || "").toLowerCase();
      const amount = Number(row.amount || 0);
      if (stage === "won") {
        oppMetrics[key].won += amount;
      } else if (stage !== "lost") {
        oppMetrics[key].open += 1;
        oppMetrics[key].pipeline += amount;
      }
    }
  }

  for (const row of projects) {
    const key = row.company_id || "";
    if (key && key in projectMetrics) {
      const status = String(row.status || "").toLowerCase();
      projectMetrics[key].total += 1;
      if (!["done", "closed", "completed", "cancelled", "canceled"].includes(status)) {
        projectMetrics[key].active += 1;
      }
      projectMetrics[key].support += Number(row.support_monthly_cost || 0);
    }
  }

  const totalPipeline = Object.values(oppMetrics).reduce((sum, x) => sum + (x.pipeline || 0), 0);
  const totalWon = Object.values(oppMetrics).reduce((sum, x) => sum + (x.won || 0), 0);
  const totalSupport = Object.values(projectMetrics).reduce((sum, x) => sum + (x.support || 0), 0);

  const [unlinkedContactsRes, unlinkedOppsRes, unlinkedProjectsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .is("company_id", null),

    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .is("company_id", null)
      .is("deleted_at", null),

    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .is("company_id", null),
  ]);

  const unlinkedContacts = unlinkedContactsRes.count ?? 0;
  const unlinkedOpps = unlinkedOppsRes.count ?? 0;
  const unlinkedProjects = unlinkedProjectsRes.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profiles"
        subtitle="Executive customer intelligence across companies, pipeline, projects, support revenue, and lead-generation targeting."
        right={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/lead-generation" className="fw-btn text-sm">
              Lead Generator
            </Link>
            {canEdit ? (
              <>
                <Link href="/dashboard/companies?new=1" className="fw-btn text-sm">
                  New Company
                </Link>
                <form action="/api/companies/link-existing" method="post">
                  <button type="submit" className="fw-btn text-sm">
                    Link Existing Records
                  </button>
                </form>
              </>
            ) : null}
            <Link href="/dashboard" className="fw-btn text-sm">
              Back to Dashboard
            </Link>
          </div>
        }
      />

      {sp.created ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Company created successfully.
        </div>
      ) : null}

      {sp.linked ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Existing contacts, opportunities, and projects were linked where a strong name match was found.
        </div>
      ) : null}

      {sp.new ? (
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Create New Company</div>
          <div className="mt-1 text-sm text-gray-600">
            Start with the executive-first fields. You can enrich and expand the full 360 profile after creation.
          </div>

          <form action="/api/companies" method="post" className="mt-5 grid gap-4 md:grid-cols-2">
            <Field name="name" label="Company Name" required placeholder="e.g. Houston Business Development Inc" />
            <Field name="website" label="Website" placeholder="https://example.com" />
            <Field name="industry" label="Industry" placeholder="Healthcare, Education, Business Development" />
            <Field name="city" label="City" placeholder="Houston" />
            <Field name="state" label="State" placeholder="TX" />
            <Field name="customer_segment" label="Customer Segment" placeholder="Startup, SMB, Enterprise, Nonprofit" />
            <Field name="lifecycle_stage" label="Lifecycle Stage" placeholder="Lead, Prospect, Proposal, Customer" />
            <Field name="priority_level" label="Priority Level" placeholder="High, Medium, Low" />
            <Field name="internal_account_owner" label="Internal Account Owner" placeholder="Derrell, Ops, Sales" />
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Executive Notes</label>
              <textarea
                name="notes"
                rows={4}
                className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm"
                placeholder="What matters most about this account right now?"
              />
            </div>

            <div className="md:col-span-2 flex gap-2 pt-2">
              <button type="submit" className="fw-btn text-sm">
                Create Company
              </button>
              <Link href="/dashboard/companies" className="fw-btn text-sm">
                Cancel
              </Link>
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Companies" value={String(companies.length)} sub="Profiles tracked" />
        <MetricCard title="Open Pipeline" value={money(totalPipeline)} sub="Across linked companies" />
        <MetricCard title="Won Revenue" value={money(totalWon)} sub="Closed-won opportunity value" />
        <MetricCard title="Support Revenue" value={money(totalSupport)} sub="Recurring support value" />
        <MetricCard title="Unlinked Records" value={String(unlinkedContacts + unlinkedOpps + unlinkedProjects)} sub={`${unlinkedContacts} contacts · ${unlinkedOpps} opps · ${unlinkedProjects} projects`} />
        <MetricCard title="Action" value={canEdit ? "Ready" : "View"} sub={canEdit ? "You can create, link, and enrich." : "Read-only visibility"} />
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-gray-900">Company Profile Command View</div>
        <div className="mt-1 text-sm text-gray-600">
          This is the cleanest place to understand how accounts connect to pipeline, projects, support revenue, and future targeting.
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1180px] w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Segment</th>
                <th className="px-3 py-2">Lifecycle</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Contacts</th>
                <th className="px-3 py-2">Pipeline</th>
                <th className="px-3 py-2">Projects</th>
                <th className="px-3 py-2">Support</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const key = company.id;
                const contactsCount = contactMetrics[key] || 0;
                const opp = oppMetrics[key] || { open: 0, pipeline: 0, won: 0 };
                const proj = projectMetrics[key] || { total: 0, active: 0, support: 0 };

                const summary =
                  company.ai_company_info?.executiveSummary ||
                  company.ai_company_info?.executive_summary ||
                  company.ai_company_info?.summary ||
                  "";

                return (
                  <tr key={company.id}>
                    <td className="rounded-l-2xl border-y border-l px-3 py-4">
                      <div className="min-w-[280px]">
                        <Link
                          href={`/dashboard/companies/${company.id}`}
                          className="text-sm font-semibold text-gray-900 hover:underline"
                        >
                          {company.name || "Unnamed Company"}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">
                          {pretty(company.industry)} • {pretty([company.city, company.state].filter(Boolean).join(", "))}
                        </div>
                        {company.website ? (
                          <div className="mt-1 text-xs text-blue-700 break-all">{company.website}</div>
                        ) : null}
                        {summary ? (
                          <div className="mt-2 line-clamp-3 text-xs text-gray-600">{summary}</div>
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

                    <td className="border-y px-3 py-4 text-sm text-gray-700">{contactsCount}</td>

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
            <div className="mt-4 text-sm text-gray-600">
              No company profiles yet. Click <span className="font-semibold">New Company</span> to create one.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard(props: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-xs text-gray-500">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      <div className="mt-1 text-sm text-gray-600">{props.sub}</div>
    </div>
  );
}

function Field(props: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{props.label}</label>
      <input
        name={props.name}
        required={props.required}
        className="w-full rounded-2xl border px-3 py-2 text-sm"
        placeholder={props.placeholder}
      />
    </div>
  );
}