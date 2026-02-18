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
};

function fmtMoney(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n || 0));
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
        throw new Error(
          `Non-JSON response (${res.status}): ${txt.slice(0, 120)}`
        );
      }
      const json = await res.json();
      if (json?.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load CEO overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pipelineTop = useMemo(
    () => (data?.pipelineByStage || []).slice(0, 6),
    [data]
  );
  const revenue = useMemo(() => data?.revenueTrend || [], [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CEO Overview"
        subtitle={
          loading
            ? "Loading live metrics..."
            : data
            ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
            : "—"
        }
        actions={
          <>
            <Link href="/dashboard/reports/pipeline" className="fw-btn text-sm">
              Pipeline
            </Link>
            <Link href="/dashboard/reports/overdue" className="fw-btn text-sm">
              Overdue
            </Link>
            <Link
              href="/dashboard/reports/projects-health"
              className="fw-btn text-sm"
            >
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

      {/* KPI Grid */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Link href="/dashboard/reports/pipeline" className="block">
          <Panel
            title="Pipeline by Stage"
            meta="Top 6 by amount (click to drill down)"
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

      {/* Quick next actions */}
      <div className="fw-card p-6">
        <div className="text-sm font-semibold text-zinc-900">
          CEO focus hints
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/reports/overdue" className="fw-btn text-sm">
            Clear overdue tasks
          </Link>
          <Link href="/dashboard/reports/pipeline" className="fw-btn text-sm">
            Push top-stage deals
          </Link>
          <Link
            href="/dashboard/reports/projects-health"
            className="fw-btn text-sm"
          >
            Fix red projects
          </Link>
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
