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
  return "$" + new Intl.NumberFormat().format(Math.round(n));
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
      setErr(e?.message || "Failed to load CEO overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pipelineTop = useMemo(() => (data?.pipelineByStage || []).slice(0, 6), [data]);
  const revenue = useMemo(() => data?.revenueTrend || [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">CEO Overview</div>
          <div className="mt-1 text-sm text-gray-600">
            {loading ? "Loading live metrics..." : data ? `Updated ${new Date(data.generatedAt).toLocaleString()}` : "—"}
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/reports/pipeline" className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Pipeline
          </Link>
          <Link href="/dashboard/reports/overdue" className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Overdue
          </Link>
          <Link href="/dashboard/reports/projects-health" className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Project Health
          </Link>
          <button type="button" onClick={load} className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {err ? <div className="rounded-3xl border bg-white p-6 shadow-sm text-sm text-gray-700">{err}</div> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/reports/pipeline" className="block">
          <KpiCard title="Open Pipeline" value={data ? fmtMoney(data.kpis.openPipeline) : "—"} sub={data ? `${data.kpis.openOppCount} open deals` : ""} />
        </Link>

        <Link href="/dashboard/reports/projects-health" className="block">
          <KpiCard title="Active Projects" value={data ? String(data.kpis.activeProjects) : "—"} sub={data ? `Total: ${data.kpis.totalProjects}` : ""} />
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
  <KpiCard title="Meetings Booked" value={data ? String(data.kpis.meetingsBooked) : "—"} sub="Freshware meetings" />
</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Link href="/dashboard/reports/pipeline" className="block">
          <Panel title="Pipeline by Stage (Top 6)">
            {data ? <BarChart rows={pipelineTop.map((x) => ({ label: x.stage, value: x.amount }))} money /> : <Skeleton />}
          </Panel>
        </Link>

        <Panel title="Revenue Trend (Last 6 Months)">
          {data ? <LineChart rows={revenue.map((x) => ({ label: x.month, value: x.amount }))} money /> : <Skeleton />}
        </Panel>
      </div>
    </div>
  );
}

function KpiCard(props: { title: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={cls("rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition", props.alert && "ring-1 ring-black/10")}>
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      {props.sub ? <div className="mt-2 text-sm text-gray-600">{props.sub}</div> : null}
    </div>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}
function Skeleton() {
  return <div className="h-44 w-full animate-pulse rounded-2xl border bg-gray-50" />;
}

function BarChart(props: { rows: Array<{ label: string; value: number }>; money?: boolean }) {
  const max = Math.max(1, ...props.rows.map((r) => r.value || 0));
  return (
    <div className="space-y-3">
      {props.rows.map((r) => {
        const pct = Math.max(2, Math.round((r.value / max) * 100));
        return (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900 truncate">{r.label}</div>
              <div className="text-sm text-gray-700">{props.money ? fmtMoney(r.value) : new Intl.NumberFormat().format(r.value)}</div>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-black" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart(props: { rows: Array<{ label: string; value: number }>; money?: boolean }) {
  const w = 560;
  const h = 160;
  const pad = 16;
  const vals = props.rows.map((r) => r.value || 0);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);

  const pts = props.rows.map((r, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, props.rows.length - 1);
    const y = pad + ((max - (r.value || 0)) * (h - pad * 2)) / Math.max(1, max - min || 1);
    return { x, y, label: r.label, value: r.value || 0 };
  });

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-2xl border bg-white">
        <path d={d} fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" />
        {pts.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="black" />
        ))}
      </svg>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-gray-600">
          {props.rows[0]?.label} → {props.rows[props.rows.length - 1]?.label}
        </div>
        <div className="font-semibold text-gray-900">
          Latest: {props.money ? fmtMoney(last?.value || 0) : new Intl.NumberFormat().format(last?.value || 0)}
        </div>
      </div>
    </div>
  );
}
