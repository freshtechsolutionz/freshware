import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import RevenueBackfillButton from "@/components/dashboard/RevenueBackfillButton";
import RevenueEntryManager from "@/components/dashboard/RevenueEntryManager";

export const runtime = "nodejs";

function money(n: number | null | undefined) {
  const v = Number(n || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "N/A";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

type Option = {
  id: string;
  label: string;
};

export default async function RevenuePage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/revenue");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Revenue</div>
        <div className="mt-2 text-sm text-gray-600">Missing profile or account assignment.</div>
      </div>
    );
  }

  const accountId = profile.account_id;
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = startOfYear(now);

  const [rowsRes, companiesRes, projectsRes, oppsRes] = await Promise.all([
    supabase
      .from("revenue_entries")
      .select(`
        id,
        title,
        amount,
        recognized_on,
        entry_date,
        revenue_type,
        type,
        status,
        paid,
        category,
        company_id,
        project_id,
        opportunity_id,
        frequency,
        source,
        start_date,
        end_date,
        description,
        payment_method,
        invoice_number,
        external_ref
      `)
      .eq("account_id", accountId)
      .order("recognized_on", { ascending: false, nullsFirst: false }),

    supabase
      .from("companies")
      .select("id, name")
      .eq("account_id", accountId)
      .order("name", { ascending: true }),

    supabase
      .from("projects")
      .select("id, name")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),

    supabase
      .from("opportunities")
      .select("id, name, stage")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (rowsRes.error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Revenue</div>
        <div className="mt-2 text-sm text-red-600">{rowsRes.error.message}</div>
      </div>
    );
  }

  const rows = rowsRes.data || [];

  const normalized = rows.map((row: any) => {
    const dateValue = row.recognized_on || row.entry_date;
    return {
      ...row,
      amount: Number(row.amount || 0),
      effectiveType: row.revenue_type || row.type || "other",
      effectiveStatus: row.status || (row.paid ? "received" : "pending") || "N/A",
      effectiveDate: dateValue ? new Date(dateValue) : null,
      displayDate: dateValue,
    };
  });

  const totalRevenue = normalized.reduce((sum, r) => sum + r.amount, 0);

  const revenueThisMonth = normalized.reduce((sum, r) => {
    if (!r.effectiveDate) return sum;
    return isSameMonth(r.effectiveDate, now) ? sum + r.amount : sum;
  }, 0);

  const revenueLastMonth = normalized.reduce((sum, r) => {
    if (!r.effectiveDate) return sum;
    return isSameMonth(r.effectiveDate, lastMonth) ? sum + r.amount : sum;
  }, 0);

  const revenueYtd = normalized.reduce((sum, r) => {
    if (!r.effectiveDate) return sum;
    return r.effectiveDate >= yearStart ? sum + r.amount : sum;
  }, 0);

  const oneTimeProjectRevenue = normalized
    .filter((r) => r.frequency !== "monthly" && r.effectiveType === "project")
    .reduce((sum, r) => sum + r.amount, 0);

  const mrr = normalized
    .filter((r) => r.frequency === "monthly" && ["active", "received", "recognized"].includes(String(r.effectiveStatus).toLowerCase()))
    .reduce((sum, r) => sum + r.amount, 0);

  const arr = mrr * 12;

  const avgRevenueEntry = normalized.length
    ? totalRevenue / normalized.length
    : 0;

  const projectRevenue = normalized.filter((r) => r.effectiveType === "project");
  const supportRevenue = normalized.filter((r) => r.effectiveType === "support" || r.frequency === "monthly");
  const manualRevenue = normalized.filter((r) => r.effectiveType === "manual");

  const companyOptions: Option[] = (companiesRes.data || []).map((x: any) => ({
    id: x.id,
    label: x.name || x.id,
  }));

  const projectOptions: Option[] = (projectsRes.data || []).map((x: any) => ({
    id: x.id,
    label: x.name || x.id,
  }));

  const opportunityOptions: Option[] = (oppsRes.data || []).map((x: any) => ({
    id: x.id,
    label: `${x.name || x.id}${x.stage ? ` • ${x.stage}` : ""}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        subtitle="Project revenue, recurring support revenue, and manual revenue all in one finance layer."
        right={
          <div className="flex gap-2">
            <RevenueBackfillButton />
            <Link href="/dashboard" className="fw-btn text-sm">
              Back to Dashboard
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Revenue This Month" value={money(revenueThisMonth)} note="Recognized this month" />
        <Metric title="Revenue YTD" value={money(revenueYtd)} note="Year-to-date" />
        <Metric title="MRR" value={money(mrr)} note="Monthly recurring support" />
        <Metric title="ARR" value={money(arr)} note="MRR × 12" />
        <Metric title="Avg Entry" value={money(avgRevenueEntry)} note="Average revenue entry size" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownCard
          title="One-Time Project Revenue"
          amount={money(oneTimeProjectRevenue)}
          subtitle="Won opportunities and project revenue"
        />
        <BreakdownCard
          title="Recurring Support Revenue"
          amount={money(mrr)}
          subtitle="Active monthly support contracts"
        />
        <BreakdownCard
          title="Last Month vs This Month"
          amount={`${money(revenueLastMonth)} → ${money(revenueThisMonth)}`}
          subtitle="Revenue momentum"
        />
      </section>

      <RevenueEntryManager
        initialRevenue={rows as any}
        companies={companyOptions}
        projects={projectOptions}
        opportunities={opportunityOptions}
      />

      <section className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Revenue Entries Snapshot</div>
        <div className="mt-1 text-sm text-gray-600">
          Quick ledger view.
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3">Title</th>
                <th className="px-3">Amount</th>
                <th className="px-3">Type</th>
                <th className="px-3">Frequency</th>
                <th className="px-3">Source</th>
                <th className="px-3">Category</th>
                <th className="px-3">Status</th>
                <th className="px-3">Recognized On</th>
              </tr>
            </thead>
            <tbody>
              {normalized.map((row: any) => (
                <tr key={row.id} className="bg-white shadow-sm">
                  <td className="rounded-l-2xl border-y border-l px-3 py-4 text-sm font-semibold text-gray-900">
                    {row.title || "Revenue Entry"}
                  </td>
                  <td className="border-y px-3 py-4 text-sm text-gray-900">{money(row.amount)}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.effectiveType}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.frequency || "one_time"}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.source || "manual"}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.category || "N/A"}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.effectiveStatus}</td>
                  <td className="rounded-r-2xl border-y border-r px-3 py-4 text-sm text-gray-700">
                    {fmtDate(row.displayDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!normalized.length ? (
            <div className="mt-4 text-sm text-gray-600">
              No revenue entries yet. Sync won opportunities and support revenue to start populating this page.
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SimpleListCard title="Project Revenue" rows={projectRevenue} />
        <SimpleListCard title="Recurring Support Revenue" rows={supportRevenue} />
        <SimpleListCard title="Manual Revenue" rows={manualRevenue} />
      </section>
    </div>
  );
}

function Metric(props: { title: string; value: string; note: string }) {
  return (
    <div className="fw-card-strong p-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      <div className="mt-2 text-sm text-gray-600">{props.note}</div>
    </div>
  );
}

function BreakdownCard(props: { title: string; amount: string; subtitle: string }) {
  return (
    <div className="fw-card p-6">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{props.amount}</div>
      <div className="mt-2 text-sm text-gray-600">{props.subtitle}</div>
    </div>
  );
}

function SimpleListCard(props: { title: string; rows: any[] }) {
  return (
    <div className="fw-card p-6">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-4 space-y-3">
        {props.rows.slice(0, 8).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                {row.title || "Revenue Entry"}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {row.frequency || "one_time"} · {row.source || "manual"}
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-900">{money(row.amount)}</div>
          </div>
        ))}
        {!props.rows.length ? (
          <div className="text-sm text-gray-600">No entries yet.</div>
        ) : null}
      </div>
    </div>
  );
}