"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MetricRow = {
  key: string;
  label: string;
  value: number | string | null;
  meta: string;
  status: "green" | "yellow" | "red";
  action: string;
};

type AdoptionData = {
  active7: number;
  active30: number;
  neverActive: number;
  completedTasks: number;
  scheduledTasks: number;
  taskCompletionRate: number;
  missingActivityNotes: number;
  lastActiveByUser: Array<{
    id: string;
    full_name: string | null;
    role: string | null;
    lastActiveAt: string | null;
    daysAgo: number | null;
  }>;
  creationByUser: Array<{
    userId: string;
    name: string;
    role: string;
    total: number;
  }>;
  moduleUsage: Array<{
    name: string;
    count: number;
  }>;
};

type SystemHealthResponse = {
  generated_at: string;
  summary: {
    overallStatus: "green" | "yellow" | "red";
    accountsScoped: boolean;
  };
  dataQuality: MetricRow[];
  adoption: AdoptionData;
  workflow: MetricRow[];
  technical: MetricRow[];
  emailMarketing: MetricRow[];
};

function statusPill(status: "green" | "yellow" | "red") {
  if (status === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "yellow") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function statusDot(status: "green" | "yellow" | "red") {
  if (status === "green") return "bg-emerald-500";
  if (status === "yellow") return "bg-amber-500";
  return "bg-red-500";
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "Never";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleString();
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch("/api/system-health", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load system health");
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to load system health");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const overallLabel = useMemo(() => {
    const status = data?.summary?.overallStatus || "yellow";
    if (status === "green") return "Healthy";
    if (status === "yellow") return "Needs Attention";
    return "At Risk";
  }, [data?.summary?.overallStatus]);

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-2xl font-semibold text-gray-900">System Health</div>
            <div className="mt-1 text-sm text-gray-600">
              Executive visibility into data hygiene, adoption, workflow reliability, and technical health.
            </div>
            {data?.generated_at ? (
              <div className="mt-2 text-xs text-gray-500">
                Updated {new Date(data.generated_at).toLocaleString()}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="fw-btn text-sm" type="button">
              Refresh
            </button>
            <Link href="/admin" className="fw-btn text-sm">
              Admin
            </Link>
            <Link href="/dashboard" className="fw-btn text-sm">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(data?.summary?.overallStatus || "yellow")}`}>
            {overallLabel}
          </span>
          <div className="text-sm text-gray-600">
            Traffic-light status is based on red/yellow/green thresholds across health metrics.
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}
      </section>

      {loading ? (
        <section className="rounded-3xl border bg-white p-6 shadow-sm text-sm text-gray-500">
          Loading system health...
        </section>
      ) : null}

      {data ? (
        <>
          <MetricSection
            title="Data Quality & Hygiene"
            subtitle="Clean data is essential for trustworthy sales and marketing execution."
            rows={data.dataQuality}
          />

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">User Adoption & Engagement</div>
            <div className="mt-1 text-sm text-gray-600">
              This section shows whether the team is actually using Freshware as intended.
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MiniMetric label="Active Users (7d)" value={String(data.adoption.active7)} />
              <MiniMetric label="Active Users (30d)" value={String(data.adoption.active30)} />
              <MiniMetric label="Never Active" value={String(data.adoption.neverActive)} />
              <MiniMetric label="Task Completion" value={`${data.adoption.taskCompletionRate}%`} />
              <MiniMetric label="Missing Activity Notes" value={String(data.adoption.missingActivityNotes)} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <Panel title="Last Active by User">
                <div className="space-y-3">
                  {data.adoption.lastActiveByUser.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{user.full_name || "Unnamed User"}</div>
                          <div className="mt-1 text-xs text-gray-500">{user.role || "Unknown Role"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">{fmtDate(user.lastActiveAt)}</div>
                          <div className="mt-1 text-xs font-semibold text-gray-700">
                            {user.daysAgo == null ? "No activity" : `${user.daysAgo} day(s) ago`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Record Creation Rate (30d)">
                <div className="space-y-3">
                  {data.adoption.creationByUser.map((row) => (
                    <div key={row.userId} className="rounded-2xl border border-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{row.name}</div>
                          <div className="mt-1 text-xs text-gray-500">{row.role}</div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{row.total}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Feature Usage Tracking">
                <div className="space-y-3">
                  {data.adoption.moduleUsage.map((row) => (
                    <div key={row.name} className="rounded-2xl border border-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">{row.name}</div>
                        <div className="text-sm font-semibold text-gray-900">{row.count}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </section>

          <MetricSection
            title="Workflow & Automation Health"
            subtitle="Broken workflows and stale deals silently create operational drag."
            rows={data.workflow}
          />

          <MetricSection
            title="Technical Performance & Integrity"
            subtitle="This section monitors the technical health of the platform itself."
            rows={data.technical}
          />

          <MetricSection
            title="Email & Marketing Health"
            subtitle="Protect deliverability and keep outreach quality under control."
            rows={data.emailMarketing}
          />
        </>
      ) : null}
    </div>
  );
}

function MetricSection(props: {
  title: string;
  subtitle: string;
  rows: MetricRow[];
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.subtitle}</div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.rows.map((row) => (
          <div key={row.key} className="rounded-2xl border border-black/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">{row.label}</div>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(row.status)}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot(row.status)}`} />
                {row.status.toUpperCase()}
              </div>
            </div>

            <div className="mt-4 text-3xl font-semibold text-gray-900">
              {row.value == null ? "—" : String(row.value)}
            </div>

            <div className="mt-2 text-sm text-gray-600">{row.meta}</div>
            <div className="mt-4 rounded-2xl border border-black/10 bg-gray-50 p-3 text-sm text-gray-700">
              <span className="font-semibold">Action:</span> {row.action}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5">
      <div className="text-xs text-gray-500">{props.label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
    </div>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/10 p-5">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}