import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import OpportunitiesClient from "@/app/opportunities/OpportunitiesClient";

export const runtime = "nodejs";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type UserLite = {
  id: string;
  full_name: string | null;
};

type AccountLite = {
  id: string;
  name: string | null;
  industry: string | null;
};

type ContactLite = {
  id: string;
  name: string | null;
  email: string | null;
  account_id: string;
};

type Opportunity = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  name: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  created_at: string;
  company_id?: string | null;
  last_touch_at?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function fmt(value: number) {
  return new Intl.NumberFormat().format(value || 0);
}

function stageSort(stage: string) {
  const s = String(stage || "").toLowerCase();
  if (s === "new") return 1;
  if (s === "qualified") return 2;
  if (s === "proposal") return 3;
  if (s === "negotiation") return 4;
  if (s === "on_hold") return 5;
  if (s === "won") return 6;
  if (s === "lost") return 7;
  return 999;
}

function normalizeProbability(probability: number | null | undefined) {
  const p = Number(probability || 0);
  return p > 1 ? p / 100 : p;
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function barWidth(value: number, max: number) {
  if (!max || max <= 0) return "2%";
  return `${Math.max(2, Math.round((value / max) * 100))}%`;
}

export default async function OpportunitiesPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/opportunities");

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError || !profileRow?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Opportunities</div>
        <div className="mt-2 text-sm text-red-600">
          {profileError?.message || "Missing account assignment on profile."}
        </div>
      </div>
    );
  }

  const profile = profileRow as Profile;
  const accountId = profile.account_id;

  const [
    usersRes,
    accountsRes,
    contactsRes,
    oppsRes,
    activitiesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("account_id", accountId)
      .order("full_name", { ascending: true }),

    supabase
      .from("accounts")
      .select("id, name, industry")
      .eq("id", accountId)
      .limit(50),

    supabase
      .from("contacts")
      .select("id, name, email, account_id")
      .eq("account_id", accountId)
      .limit(500),

    supabase
      .from("opportunities")
      .select(
        "id, account_id, contact_id, owner_user_id, name, service_line, stage, amount, probability, close_date, created_at, company_id"
      )
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("opportunity_activities")
      .select("opportunity_id, occurred_at")
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false }),
  ]);

  const lookupError =
    usersRes.error?.message ||
    accountsRes.error?.message ||
    contactsRes.error?.message ||
    null;

  const rowsError = oppsRes.error?.message || null;

  const oppRows = (oppsRes.data || []) as Opportunity[];
  const activityRows = (activitiesRes.data || []) as Array<{
    opportunity_id: string | null;
    occurred_at: string | null;
  }>;

  const latestActivityByOpp = new Map<string, string>();
  for (const row of activityRows) {
    const oppId = row.opportunity_id || "";
    const occurredAt = row.occurred_at || "";
    if (!oppId || !occurredAt) continue;
    if (!latestActivityByOpp.has(oppId)) {
      latestActivityByOpp.set(oppId, occurredAt);
    }
  }

  const rowsWithTouch = oppRows.map((row) => ({
    ...row,
    last_touch_at: latestActivityByOpp.get(row.id) || null,
  }));

  const openRows = rowsWithTouch.filter((row) => {
    const s = String(row.stage || "").toLowerCase();
    return s !== "won" && s !== "lost";
  });

  const wonRows = rowsWithTouch.filter((row) => String(row.stage || "").toLowerCase() === "won");
  const lostRows = rowsWithTouch.filter((row) => String(row.stage || "").toLowerCase() === "lost");

  const totalPipeline = openRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const weightedPipeline = openRows.reduce((sum, row) => {
    const amount = Number(row.amount) || 0;
    const probability = normalizeProbability(row.probability);
    return sum + amount * probability;
  }, 0);

  const staleDeals = openRows.filter((row) => {
    const lastTouch = row.last_touch_at || row.created_at;
    const days = daysSince(lastTouch);
    return days != null && days >= 21;
  });

  const closeWindow = new Date();
  closeWindow.setDate(closeWindow.getDate() + 30);

  const closingSoon = openRows.filter((row) => {
    if (!row.close_date) return false;
    const d = new Date(row.close_date);
    if (Number.isNaN(d.getTime())) return false;
    return d >= new Date() && d <= closeWindow;
  });

  const stageBreakdown = Array.from(
    rowsWithTouch.reduce((map, row) => {
      const stage = String(row.stage || "unknown").toLowerCase();
      const current = map.get(stage) || {
        stage,
        count: 0,
        amount: 0,
        weighted: 0,
      };
      current.count += 1;
      current.amount += Number(row.amount || 0);
      current.weighted += (Number(row.amount || 0) * normalizeProbability(row.probability));
      map.set(stage, current);
      return map;
    }, new Map<string, { stage: string; count: number; amount: number; weighted: number }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => stageSort(a.stage) - stageSort(b.stage));

  const maxStageValue = Math.max(
    1,
    ...stageBreakdown.map((row) => row.weighted || row.amount || 0)
  );

  const topOpenDeals = [...openRows]
    .sort((a, b) => {
      const aw = (Number(a.amount || 0) * normalizeProbability(a.probability));
      const bw = (Number(b.amount || 0) * normalizeProbability(b.probability));
      return bw - aw;
    })
    .slice(0, 6);

  return (
    <div className="space-y-6 pb-10">
      <section className="fw-card-strong p-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">Opportunities</div>
            <div className="mt-1 text-sm text-zinc-600">
              Pipeline visibility, stage mix, stale deal risk, and top-value focus.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/dashboard/reports/pipeline" className="fw-btn text-sm">
              Pipeline Drilldown
            </a>
            <a href="/dashboard/reports/weekly" className="fw-btn text-sm">
              Weekly Executive Report
            </a>
            <a href="/dashboard/opportunities/new" className="fw-btn text-sm">
              New Opportunity
            </a>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Open Deals" value={fmt(openRows.length)} sub={`${fmt(rowsWithTouch.length)} total`} />
          <MetricCard title="Open Pipeline" value={money(totalPipeline)} sub={`${fmt(wonRows.length)} won`} />
          <MetricCard title="Weighted Pipeline" value={money(weightedPipeline)} sub="Probability-adjusted" />
          <MetricCard title="Closing in 30 Days" value={fmt(closingSoon.length)} sub={money(closingSoon.reduce((s, r) => s + (Number(r.amount) || 0), 0))} />
          <MetricCard title="Stale Deals" value={fmt(staleDeals.length)} sub="21+ days no touch" />
          <MetricCard title="Lost Deals" value={fmt(lostRows.length)} sub="Closed lost" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="fw-card-strong p-6">
          <div className="text-lg font-semibold text-zinc-900">Stage Breakdown</div>
          <div className="mt-1 text-sm text-zinc-600">
            Weighted value and count by stage so the page feels strategic again without changing your working client stack.
          </div>

          <div className="mt-5 space-y-4">
            {stageBreakdown.length ? (
              stageBreakdown.map((row) => (
                <div key={row.stage} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-900 capitalize">{row.stage}</div>
                    <div className="text-sm text-zinc-600">
                      {fmt(row.count)} deal(s) · {money(row.weighted)} weighted
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full bg-black/10">
                    <div
                      className="h-3 rounded-full bg-black"
                      style={{ width: barWidth(row.weighted || row.amount, maxStageValue) }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">No opportunities found yet.</div>
            )}
          </div>
        </div>

        <div className="fw-card-strong p-6">
          <div className="text-lg font-semibold text-zinc-900">Top Open Deals</div>
          <div className="mt-1 text-sm text-zinc-600">
            Highest-value opportunities that deserve executive attention first.
          </div>

          <div className="mt-5 space-y-3">
            {topOpenDeals.length ? (
              topOpenDeals.map((row) => {
                const weighted = Number(row.amount || 0) * normalizeProbability(row.probability);
                const stale = (() => {
                  const d = daysSince(row.last_touch_at || row.created_at);
                  return d != null ? d : null;
                })();

                return (
                  <div key={row.id} className="rounded-2xl border border-black/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {row.name || "Unnamed Opportunity"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {(row.stage || "unknown").toString()} · {serviceLabel(row.service_line)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Close: {row.close_date ? new Date(row.close_date).toLocaleDateString() : "No close date"} ·
                          Last touch: {row.last_touch_at ? new Date(row.last_touch_at).toLocaleDateString() : "No activity"} ·
                          {stale != null ? ` ${stale} day(s) idle` : " No idle data"}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-zinc-900">{money(Number(row.amount || 0))}</div>
                        <div className="mt-1 text-xs text-zinc-500">{money(weighted)} weighted</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-zinc-500">No open opportunities yet.</div>
            )}
          </div>
        </div>
      </section>

      <OpportunitiesClient
        profile={profile}
        users={(usersRes.data || []) as UserLite[]}
        initialAccounts={(accountsRes.data || []) as AccountLite[]}
        initialContacts={(contactsRes.data || []) as ContactLite[]}
        initialRows={rowsWithTouch}
        lookupError={lookupError}
        rowsError={rowsError}
      />
    </div>
  );
}

function MetricCard(props: { title: string; value: string; sub: string }) {
  return (
    <div className="fw-card p-5">
      <div className="text-xs font-semibold text-zinc-500">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{props.value}</div>
      <div className="mt-1 text-sm text-zinc-600">{props.sub}</div>
    </div>
  );
}

function serviceLabel(value: string | null | undefined) {
  const v = String(value || "").trim();
  if (!v) return "Unknown service";
  return v
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}