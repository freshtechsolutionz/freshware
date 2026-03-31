"use client";

import { useEffect, useMemo, useState } from "react";

type WeeklyReportResponse = {
  text: string;
  generated_at?: string;
  summary?: {
    kpis?: Record<string, number>;
    stage_breakdown?: Array<{
      stage: string;
      opp_count: number;
      pipeline_amount: number;
      weighted_pipeline_amount: number;
      avg_days_open: number;
      avg_days_since_activity: number;
    }>;
    stuck_deals?: Array<{
      opportunity_id: string;
      opportunity_name: string | null;
      stage: string | null;
      weighted_amount: number | null;
      days_since_activity: number | null;
      next_step: string | null;
      close_date: string | null;
    }>;
    upcoming_closes?: Array<{
      opportunity_id: string;
      opportunity_name: string | null;
      stage: string | null;
      weighted_amount: number | null;
      close_date: string | null;
    }>;
    enterprise_blockers?: Array<{
      opportunity_id: string;
      opportunity_name: string | null;
      stage: string | null;
      weighted_amount: number | null;
      missing_budget?: boolean;
      missing_timeline?: boolean;
      missing_decision_maker?: boolean;
      days_since_activity?: number | null;
    }>;
  } | null;
  overview?: {
    overdueTasks: number;
    blockedTasks: number;
    meetingsBooked: number;
    activeProjects: number;
    totalProjects: number;
    openOppCount: number;
    openPipeline: number;
  } | null;
  lead_digest?: {
    newLeads: number;
    responded: number;
    followUpDue: number;
    highScore: number;
    total: number;
  } | null;
};

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    const txt = await res.text();
    throw new Error(`Non-JSON response (${res.status}). ${txt.slice(0, 180)}`);
  }
  return res.json();
}

function money(n: number | null | undefined) {
  const value = Number(n || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function num(n: number | null | undefined) {
  return new Intl.NumberFormat().format(Number(n || 0));
}

export default function WeeklyReportPage() {
  const [data, setData] = useState<WeeklyReportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ceo/weekly-report", { cache: "no-store" });
      const json = await safeJson(res);
      if (json?.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load weekly report");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const stageRows = useMemo(() => data?.summary?.stage_breakdown || [], [data]);
  const stuckDeals = useMemo(() => data?.summary?.stuck_deals || [], [data]);
  const upcomingCloses = useMemo(() => data?.summary?.upcoming_closes || [], [data]);
  const blockers = useMemo(() => data?.summary?.enterprise_blockers || [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Weekly Executive Report</div>
          <div className="mt-1 text-sm text-zinc-600">
            Monday-morning executive briefing across pipeline, delivery, execution, and lead momentum.
          </div>
          {data?.generated_at ? (
            <div className="mt-1 text-xs text-zinc-500">
              Generated {new Date(data.generated_at).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <button onClick={load} className="fw-btn text-sm" disabled={busy} type="button">
            {busy ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data?.text || "");
              setToast("Copied");
            }}
            className="fw-btn text-sm"
            disabled={!data?.text}
            type="button"
          >
            Copy
          </button>
        </div>
      </div>

      {toast ? <div className="fw-card-strong p-4 text-sm font-semibold text-zinc-900">{toast}</div> : null}
      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Open Pipeline"
          value={money(data?.overview?.openPipeline)}
          sub={`${num(data?.overview?.openOppCount)} open deals`}
        />
        <MetricCard
          title="Active Projects"
          value={num(data?.overview?.activeProjects)}
          sub={`Total: ${num(data?.overview?.totalProjects)}`}
        />
        <MetricCard
          title="Overdue Tasks"
          value={num(data?.overview?.overdueTasks)}
          sub={`Blocked: ${num(data?.overview?.blockedTasks)}`}
        />
        <MetricCard
          title="Meetings Booked"
          value={num(data?.overview?.meetingsBooked)}
          sub="Freshware meetings"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="New Leads"
          value={num(data?.lead_digest?.newLeads)}
          sub={`Total tracked: ${num(data?.lead_digest?.total)}`}
        />
        <MetricCard
          title="Lead Replies"
          value={num(data?.lead_digest?.responded)}
          sub="Responded outreach"
        />
        <MetricCard
          title="Follow-Ups Due"
          value={num(data?.lead_digest?.followUpDue)}
          sub="Needs action now"
        />
        <MetricCard
          title="80+ Leads"
          value={num(data?.lead_digest?.highScore)}
          sub="High-score lead inventory"
        />
      </div>

      <section className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-zinc-900">Executive Scoreboard</div>
        <div className="mt-1 text-sm text-zinc-600">
          Pipeline stage mix and weighted value from the CEO reporting layer.
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Deals</th>
                <th className="px-3 py-3">Pipeline</th>
                <th className="px-3 py-3">Weighted</th>
                <th className="px-3 py-3">Avg Days Open</th>
                <th className="px-3 py-3">Avg Days Since Activity</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((row) => (
                <tr key={row.stage} className="border-b border-black/5">
                  <td className="px-3 py-3 font-semibold text-zinc-900">{row.stage}</td>
                  <td className="px-3 py-3">{num(row.opp_count)}</td>
                  <td className="px-3 py-3">{money(row.pipeline_amount)}</td>
                  <td className="px-3 py-3">{money(row.weighted_pipeline_amount)}</td>
                  <td className="px-3 py-3">{num(row.avg_days_open)}</td>
                  <td className="px-3 py-3">{num(row.avg_days_since_activity)}</td>
                </tr>
              ))}
              {!stageRows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No stage data available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Stuck Deals" subtitle="Deals with inactivity drag">
          {stuckDeals.length ? (
            <div className="space-y-3">
              {stuckDeals.map((deal) => (
                <ListRow
                  key={deal.opportunity_id}
                  title={deal.opportunity_name || "Unnamed deal"}
                  subtitle={`${deal.stage || "Unstaged"} • ${deal.days_since_activity ?? "—"} days idle`}
                  meta={deal.next_step || "No next step logged"}
                  value={money(deal.weighted_amount)}
                />
              ))}
            </div>
          ) : (
            <EmptyText text="No stuck deals surfaced right now." />
          )}
        </SectionCard>

        <SectionCard title="Upcoming Closes" subtitle="Near-term close pressure">
          {upcomingCloses.length ? (
            <div className="space-y-3">
              {upcomingCloses.map((deal) => (
                <ListRow
                  key={deal.opportunity_id}
                  title={deal.opportunity_name || "Unnamed deal"}
                  subtitle={`${deal.stage || "Unstaged"} • ${deal.close_date || "No close date"}`}
                  value={money(deal.weighted_amount)}
                />
              ))}
            </div>
          ) : (
            <EmptyText text="No upcoming close dates surfaced right now." />
          )}
        </SectionCard>

        <SectionCard title="Enterprise Blockers" subtitle="Missing critical buying information">
          {blockers.length ? (
            <div className="space-y-3">
              {blockers.map((deal) => {
                const blockerList = [
                  deal.missing_budget ? "budget" : null,
                  deal.missing_timeline ? "timeline" : null,
                  deal.missing_decision_maker ? "decision maker" : null,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <ListRow
                    key={deal.opportunity_id}
                    title={deal.opportunity_name || "Unnamed deal"}
                    subtitle={`${deal.stage || "Unstaged"} • Missing ${blockerList || "core info"}`}
                    meta={
                      deal.days_since_activity != null
                        ? `${deal.days_since_activity} days since activity`
                        : undefined
                    }
                    value={money(deal.weighted_amount)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyText text="No enterprise blockers surfaced right now." />
          )}
        </SectionCard>
      </div>

      <section className="fw-card-strong p-7">
        <div className="text-sm font-semibold text-zinc-900">Report Output</div>
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
          <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-900">
            {data?.text || (busy ? "Generating..." : "No report returned.")}
          </pre>
        </div>
      </section>
    </div>
  );
}

function MetricCard(props: { title: string; value: string; sub: string }) {
  return (
    <div className="fw-card p-6">
      <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-zinc-900">{props.value}</div>
      <div className="mt-2 text-sm text-zinc-600">{props.sub}</div>
    </div>
  );
}

function SectionCard(props: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fw-card p-6">
      <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
      <div className="mt-1 text-sm text-zinc-600">{props.subtitle}</div>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function ListRow(props: {
  title: string;
  subtitle: string;
  meta?: string;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">{props.title}</div>
          <div className="mt-1 text-xs text-zinc-600">{props.subtitle}</div>
          {props.meta ? <div className="mt-1 text-xs text-zinc-500">{props.meta}</div> : null}
        </div>
        {props.value ? <div className="shrink-0 text-sm font-semibold text-zinc-900">{props.value}</div> : null}
      </div>
    </div>
  );
}

function EmptyText(props: { text: string }) {
  return <div className="text-sm text-zinc-500">{props.text}</div>;
}