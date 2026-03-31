"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Overview = {
  generatedAt: string;
  kpis: {
    overdueTasks: number;
    blockedTasks: number;
    meetingsBooked: number;
    activeProjects: number;
    totalProjects: number;
    openOppCount: number;
    openPipeline: number;
  };
  pipelineByStage: Array<{ stage: string; count: number; amount: number }>;
  revenueTrend: Array<{ month: string; amount: number }>;
  ceoMondaySummary?: {
    generated_at?: string;
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
      amount: number | null;
      weighted_amount: number | null;
      days_since_activity: number | null;
      close_date: string | null;
      next_step: string | null;
    }>;
    upcoming_closes?: Array<{
      opportunity_id: string;
      opportunity_name: string | null;
      stage: string | null;
      weighted_amount: number | null;
      close_date: string | null;
      days_since_activity: number | null;
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
};

function fmtMoney(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n || 0));
}

function fmtNum(n: number) {
  return new Intl.NumberFormat().format(Math.round(n || 0));
}

function cls(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

export default function CeoOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ceo/overview", { cache: "no-store" });
      const ct = res.headers.get("content-type") || "";
      if (!ct.toLowerCase().includes("application/json")) {
        const txt = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${txt.slice(0, 120)}`);
      }
      const json = await res.json();
      if (json?.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load executive overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pipelineTop = useMemo(
    () => (data?.ceoMondaySummary?.stage_breakdown?.length
      ? data.ceoMondaySummary.stage_breakdown.slice(0, 6).map((x) => ({
          stage: x.stage,
          count: x.opp_count,
          amount: Number(x.weighted_pipeline_amount || x.pipeline_amount || 0),
        }))
      : (data?.pipelineByStage || []).slice(0, 6)),
    [data]
  );

  const revenue = useMemo(() => data?.revenueTrend || [], [data]);

  const stuckDeals = useMemo(
    () => data?.ceoMondaySummary?.stuck_deals?.slice(0, 5) || [],
    [data]
  );

  const enterpriseBlockers = useMemo(
    () => data?.ceoMondaySummary?.enterprise_blockers?.slice(0, 5) || [],
    [data]
  );

  const upcomingCloses = useMemo(
    () => data?.ceoMondaySummary?.upcoming_closes?.slice(0, 5) || [],
    [data]
  );

  const kpiSummary = data?.ceoMondaySummary?.kpis || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Overview"
        subtitle={
          loading
            ? "Loading live metrics..."
            : data
            ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
            : "—"
        }
        actions={
          <>
            <Link href="/dashboard/reports/weekly" className="fw-btn text-sm">
              Weekly Report
            </Link>
            <Link href="/dashboard/reports/pipeline" className="fw-btn text-sm">
              Pipeline
            </Link>
            <Link href="/dashboard/reports/overdue" className="fw-btn text-sm">
              Overdue
            </Link>
            <Link href="/dashboard/reports/projects-health" className="fw-btn text-sm">
              Project Health
            </Link>
            <button type="button" onClick={load} className="fw-btn text-sm">
              Refresh
            </button>
          </>
        }
      />

      {err ? (
        <div className="fw-card-strong p-7 text-sm text-zinc-700">
          <div className="font-semibold text-zinc-900">Live data error</div>
          <div className="mt-2 whitespace-pre-wrap">{err}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/dashboard/reports/pipeline" className="block">
          <KpiCard
            title="Open Pipeline"
            value={data ? fmtMoney(data.kpis.openPipeline) : "—"}
            sub={data ? `${data.kpis.openOppCount} open deals` : ""}
          />
        </Link>

        <Link href="/dashboard/reports/projects-health" className="block">
          <KpiCard
            title="Active Projects"
            value={data ? String(data.kpis.activeProjects) : "—"}
            sub={data ? `Total: ${data.kpis.totalProjects}` : ""}
          />
        </Link>

        <Link href="/dashboard/reports/overdue" className="block">
          <KpiCard
            title="Overdue Tasks"
            value={data ? String(data.kpis.overdueTasks) : "—"}
            sub={data ? `${data.kpis.blockedTasks} blocked` : ""}
            alert
          />
        </Link>

        <Link href="/dashboard/meetings" className="block">
          <KpiCard
            title="Meetings Booked"
            value={data ? String(data.kpis.meetingsBooked) : "—"}
            sub="Freshware meetings"
          />
        </Link>
      </div>

      {kpiSummary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Panel title="Executive Pipeline" meta="CEO SQL intelligence layer">
            <div className="space-y-3 text-sm text-zinc-700">
              <SummaryRow label="All pipeline" value={fmtMoney(Number(kpiSummary.pipeline_amount_all || 0))} />
              <SummaryRow label="Weighted pipeline" value={fmtMoney(Number(kpiSummary.weighted_pipeline_all || 0))} />
              <SummaryRow label="Enterprise pipeline" value={fmtMoney(Number(kpiSummary.pipeline_amount_enterprise || 0))} />
              <SummaryRow label="Avg deal size" value={fmtMoney(Number(kpiSummary.avg_deal_size_all || 0))} />
            </div>
          </Panel>

          <Panel title="Enterprise Focus" meta="Larger strategic opportunities">
            <div className="space-y-3 text-sm text-zinc-700">
              <SummaryRow label="Enterprise deals" value={fmtNum(Number(kpiSummary.opp_count_enterprise || 0))} />
              <SummaryRow label="Enterprise weighted" value={fmtMoney(Number(kpiSummary.weighted_pipeline_enterprise || 0))} />
              <SummaryRow label="Avg enterprise deal" value={fmtMoney(Number(kpiSummary.avg_deal_size_enterprise || 0))} />
              <SummaryRow label="Avg inactivity" value={`${fmtNum(Number(kpiSummary.avg_days_since_activity_enterprise || 0))} days`} />
            </div>
          </Panel>

          <Panel title="Stuck Deals" meta="21+ days since activity">
            {stuckDeals.length ? (
              <div className="space-y-3">
                {stuckDeals.map((deal) => (
                  <MiniDealRow
                    key={deal.opportunity_id}
                    title={deal.opportunity_name || "Unnamed deal"}
                    meta={`${deal.stage || "Unstaged"} • ${deal.days_since_activity ?? "—"} days idle`}
                    value={fmtMoney(Number(deal.weighted_amount || deal.amount || 0))}
                  />
                ))}
              </div>
            ) : (
              <EmptySmall text="No stuck deals right now." />
            )}
          </Panel>

          <Panel title="Upcoming Closes" meta="Deals closing soon">
            {upcomingCloses.length ? (
              <div className="space-y-3">
                {upcomingCloses.map((deal) => (
                  <MiniDealRow
                    key={deal.opportunity_id}
                    title={deal.opportunity_name || "Unnamed deal"}
                    meta={`${deal.stage || "Unstaged"} • ${deal.close_date || "No close date"}`}
                    value={fmtMoney(Number(deal.weighted_amount || 0))}
                  />
                ))}
              </div>
            ) : (
              <EmptySmall text="No upcoming closes found." />
            )}
          </Panel>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Link href="/dashboard/reports/pipeline" className="block">
          <Panel
            title="Pipeline by Stage"
            meta="Top stages by weighted value"
          >
            {data ? (
              <BarChart
                rows={pipelineTop.map((x) => ({
                  label: x.stage,
                  value: x.amount,
                }))}
                money
              />
            ) : (
              <Skeleton />
            )}
          </Panel>
        </Link>

        <Panel title="Revenue Trend" meta="Last 6 months">
          {data ? (
            <LineChart
              rows={revenue.map((x) => ({ label: x.month, value: x.amount }))}
              money
            />
          ) : (
            <Skeleton />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Enterprise Blockers" meta="Missing budget, timeline, or decision maker">
          {enterpriseBlockers.length ? (
            <div className="space-y-3">
              {enterpriseBlockers.map((deal) => {
                const blockers = [
                  deal.missing_budget ? "budget" : null,
                  deal.missing_timeline ? "timeline" : null,
                  deal.missing_decision_maker ? "decision maker" : null,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <MiniDealRow
                    key={deal.opportunity_id}
                    title={deal.opportunity_name || "Unnamed deal"}
                    meta={`${deal.stage || "Unstaged"} • Missing ${blockers || "core info"}`}
                    value={fmtMoney(Number(deal.weighted_amount || 0))}
                  />
                );
              })}
            </div>
          ) : (
            <EmptySmall text="No enterprise blockers surfaced right now." />
          )}
        </Panel>

        <div className="fw-card p-6">
          <div className="text-sm font-semibold text-zinc-900">Executive focus hints</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/dashboard/reports/overdue" className="fw-btn text-sm">
              Clear overdue tasks
            </Link>
            <Link href="/dashboard/reports/pipeline" className="fw-btn text-sm">
              Push top-stage deals
            </Link>
            <Link href="/dashboard/reports/projects-health" className="fw-btn text-sm">
              Fix red projects
            </Link>
            <Link href="/dashboard/lead-generation" className="fw-btn text-sm">
              Work follow-up queue
            </Link>
            <Link href="/dashboard/companies" className="fw-btn text-sm">
              Review company profiles
            </Link>
            <Link href="/dashboard/reports/weekly" className="fw-btn text-sm">
              Open weekly briefing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="text-2xl font-semibold tracking-tight text-zinc-900">
          {props.title}
        </div>
        {props.subtitle ? (
          <div className="mt-1 text-sm text-zinc-600">{props.subtitle}</div>
        ) : null}
      </div>

      {props.actions ? (
        <div className="flex flex-wrap gap-2">{props.actions}</div>
      ) : null}
    </div>
  );
}

function KpiCard(props: {
  title: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cls(
        "fw-card fw-interactive p-6",
        props.alert && "ring-1 ring-black/10"
      )}
    >
      <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
        {props.value}
      </div>
      {props.sub ? (
        <div className="mt-2 text-sm text-zinc-600">{props.sub}</div>
      ) : null}
      <div className="mt-4 text-xs text-zinc-500">Click to drill down</div>
    </div>
  );
}

function Panel(props: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fw-card fw-interactive p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">
            {props.title}
          </div>
          {props.meta ? (
            <div className="mt-1 text-xs text-zinc-600">{props.meta}</div>
          ) : null}
        </div>
        <span className="fw-chip">Live</span>
      </div>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{props.label}</span>
      <span className="font-semibold text-zinc-900">{props.value}</span>
    </div>
  );
}

function MiniDealRow(props: { title: string; meta: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">{props.title}</div>
          <div className="mt-1 text-xs text-zinc-600">{props.meta}</div>
        </div>
        <div className="shrink-0 text-sm font-semibold text-zinc-900">{props.value}</div>
      </div>
    </div>
  );
}

function EmptySmall(props: { text: string }) {
  return <div className="text-sm text-zinc-500">{props.text}</div>;
}

function Skeleton() {
  return (
    <div className="h-44 w-full animate-pulse rounded-2xl border border-black/10 bg-white/60" />
  );
}

function BarChart(props: {
  rows: Array<{ label: string; value: number }>;
  money?: boolean;
}) {
  const max = Math.max(1, ...props.rows.map((r) => r.value || 0));
  return (
    <div className="space-y-3">
      {props.rows.map((r) => {
        const pct = Math.max(2, Math.round(((r.value || 0) / max) * 100));
        return (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold text-zinc-900">
                {r.label}
              </div>
              <div className="text-sm text-zinc-700">
                {props.money
                  ? fmtMoney(r.value)
                  : new Intl.NumberFormat().format(r.value || 0)}
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-black/10">
              <div
                className="h-3 rounded-full bg-black"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart(props: {
  rows: Array<{ label: string; value: number }>;
  money?: boolean;
}) {
  const w = 560;
  const h = 160;
  const pad = 16;
  const vals = props.rows.map((r) => r.value || 0);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);

  const pts = props.rows.map((r, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, props.rows.length - 1);
    const y =
      pad +
      ((max - (r.value || 0)) * (h - pad * 2)) / Math.max(1, max - min || 1);
    return { x, y, label: r.label, value: r.value || 0 };
  });

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1];

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full rounded-2xl border border-black/10 bg-white/70"
      >
        <path
          d={d}
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {pts.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="black" />
        ))}
      </svg>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-zinc-600">
          {props.rows[0]?.label} → {props.rows[props.rows.length - 1]?.label}
        </div>
        <div className="font-semibold text-zinc-900">
          Latest:{" "}
          {props.money
            ? fmtMoney(last?.value || 0)
            : new Intl.NumberFormat().format(last?.value || 0)}
        </div>
      </div>
    </div>
  );
}