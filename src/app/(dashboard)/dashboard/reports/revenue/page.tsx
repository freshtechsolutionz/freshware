import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function fmtMoney(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n));
}

export default async function RevenueReportPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/reports/revenue");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const roleUpper = String(me?.role || "").toUpperCase();
  const isAdmin = roleUpper === "CEO" || roleUpper === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-zinc-900">Revenue</div>
        <div className="mt-2 text-sm text-zinc-600">Restricted (CEO/Admin only).</div>
        <div className="mt-4">
          <Link href="/dashboard" className="fw-btn text-sm">Back</Link>
        </div>
      </div>
    );
  }

  if (!me?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-zinc-900">Revenue</div>
        <div className="mt-2 text-sm text-zinc-600">Missing account_id on your profile.</div>
      </div>
    );
  }

  const { data } = await supabase
    .from("revenue_entries")
    .select("amount, created_at")
    .eq("account_id", me.account_id)
    .order("created_at", { ascending: false });

  const rows = (data as Array<{ amount: any; created_at: string }>) ?? [];

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Monthly buckets (last 6 months)
  const now = new Date();
  const buckets: Array<{ key: string; label: string; amount: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString(undefined, { month: "short", year: "numeric" });
    buckets.push({ key, label, amount: 0 });
  }

  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.find((x) => x.key === key);
    if (b) b.amount += Number(r.amount) || 0;
  }

  const max = Math.max(1, ...buckets.map((b) => b.amount));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Revenue</div>
          <div className="mt-1 text-sm text-zinc-600">Account-scoped revenue_entries summary.</div>
        </div>
        <Link href="/dashboard" className="fw-btn text-sm">Back</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="fw-card-strong p-7 lg:col-span-2">
          <div className="text-sm font-semibold text-zinc-900">Last 6 Months</div>
          <div className="mt-4 space-y-3">
            {buckets.map((b) => {
              const pct = Math.max(2, Math.round((b.amount / max) * 100));
              return (
                <div key={b.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-900">{b.label}</div>
                    <div className="text-sm text-zinc-700">{fmtMoney(b.amount)}</div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-black/10">
                    <div className="h-3 rounded-full bg-black" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fw-card-strong p-7">
          <div className="text-sm font-semibold text-zinc-900">Total</div>
          <div className="mt-2 text-4xl font-semibold text-zinc-900">{fmtMoney(total)}</div>
          <div className="mt-2 text-sm text-zinc-600">{rows.length} entries</div>

          <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-zinc-700">
            If this is showing “—” on the dashboard, it usually means either:
            <div className="mt-2 text-xs text-zinc-600">
              1) your user is not CEO/Admin, or 2) revenue_entries has no rows for this account_id.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
