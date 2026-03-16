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

function fmtDate(v: string | null | undefined) {
  if (!v) return "N/A";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

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

  const { data: rows, error } = await supabase
    .from("revenue_entries")
    .select("id, title, amount, recognized_on, entry_date, revenue_type, type, status, paid, category, company_id, project_id, opportunity_id")
    .eq("account_id", profile.account_id)
    .order("recognized_on", { ascending: false, nullsFirst: false });

  if (error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Revenue</div>
        <div className="mt-2 text-sm text-red-600">{error.message}</div>
      </div>
    );
  }

  const total = (rows || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

  const byType: Record<string, number> = {};
  for (const row of rows || []) {
    const key = String((row as any).revenue_type || "other");
    byType[key] = (byType[key] || 0) + (Number((row as any).amount) || 0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        subtitle="Track recognized revenue across companies, projects, opportunities, and revenue types."
        right={
          <div className="flex gap-2">
            <Link href="/dashboard" className="fw-btn text-sm">
              Back to Dashboard
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="fw-card-strong p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Revenue</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{money(total)}</div>
          <div className="mt-2 text-sm text-gray-600">All recognized revenue entries</div>
        </div>

        {Object.entries(byType).slice(0, 3).map(([key, value]) => (
          <div key={key} className="fw-card-strong p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{key}</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{money(value)}</div>
            <div className="mt-2 text-sm text-gray-600">Revenue by type</div>
          </div>
        ))}
      </section>

      <section className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Revenue Entries</div>
        <div className="mt-1 text-sm text-gray-600">This is the operational finance layer for Freshware.</div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3">Title</th>
                <th className="px-3">Amount</th>
                <th className="px-3">Type</th>
                <th className="px-3">Category</th>
                <th className="px-3">Status</th>
                <th className="px-3">Recognized On</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((row: any) => (
                <tr key={row.id} className="bg-white shadow-sm">
                  <td className="rounded-l-2xl border-y border-l px-3 py-4 text-sm font-semibold text-gray-900">
                    {row.title}
                  </td>
                  <td className="border-y px-3 py-4 text-sm text-gray-900">{money(row.amount)}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.revenue_type || row.type || "N/A"}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.category || "N/A"}</td>
                  <td className="border-y px-3 py-4 text-sm text-gray-700">{row.status || (row.paid ? "received" : "pending") || "N/A"}</td>
                  <td className="rounded-r-2xl border-y border-r px-3 py-4 text-sm text-gray-700">
                    {fmtDate(row.recognized_on || row.entry_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!rows?.length ? (
            <div className="mt-4 text-sm text-gray-600">
              No revenue entries yet. Start by inserting a few historical deals or support payments.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}