"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type HealthCounts = { GREEN: number; YELLOW: number; RED: number; UNKNOWN: number };

type ProjectHealthRow = {
  id: string;
  name: string | null;
  status: string | null;
  stage: string | null;
  start_date: string | null;
  due_date: string | null;
  computed_health: string;
};

type ProjectsHealthResponse = {
  counts: HealthCounts;
  projects: ProjectHealthRow[];
};

async function fetchJson(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    redirect: "manual",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "N/A";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function daysTo(due: string | null | undefined) {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function healthClasses(h: string) {
  const v = String(h || "").toUpperCase();
  if (v === "GREEN") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (v === "YELLOW") return "border-amber-200 bg-amber-50 text-amber-800";
  if (v === "RED") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default function ProjectsHealthReportPage() {
  const [data, setData] = useState<ProjectsHealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "GREEN" | "YELLOW" | "RED" | "UNKNOWN">("ALL");

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const json = (await fetchJson("/api/ceo/projects-health")) as ProjectsHealthResponse;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Unable to reach projects health API");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const all = data?.projects || [];
    const weight: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, UNKNOWN: 3 };

    const filtered =
      filter === "ALL"
        ? all
        : all.filter((p) => String(p.computed_health || "").toUpperCase() === filter);

    return [...filtered].sort((a, b) => {
      const wa = weight[String(a.computed_health || "").toUpperCase()] ?? 9;
      const wb = weight[String(b.computed_health || "").toUpperCase()] ?? 9;
      if (wa !== wb) return wa - wb;

      const da = daysTo(a.due_date);
      const db = daysTo(b.due_date);
      return (da ?? 99999) - (db ?? 99999);
    });
  }, [data, filter]);

  const total = (data?.counts.GREEN || 0) + (data?.counts.YELLOW || 0) + (data?.counts.RED || 0) + (data?.counts.UNKNOWN || 0);

  const redPct = total ? Math.round(((data?.counts.RED || 0) / total) * 100) : 0;
  const yellowPct = total ? Math.round(((data?.counts.YELLOW || 0) / total) * 100) : 0;
  const greenPct = total ? Math.round(((data?.counts.GREEN || 0) / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Reports</div>
            <div className="text-xl font-semibold">Project Health Heat Map</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Executive risk view of the entire portfolio.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/projects" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              Back to Projects
            </Link>
            <button
              onClick={load}
              disabled={busy}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              {busy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-2xl border p-5 text-left ${filter === "ALL" ? "bg-gray-900 text-white" : "bg-white"}`}
        >
          <div className="text-xs opacity-80">All Projects</div>
          <div className="mt-2 text-2xl font-semibold">{total}</div>
        </button>

        <button
          onClick={() => setFilter("GREEN")}
          className={`rounded-2xl border p-5 text-left ${filter === "GREEN" ? "bg-emerald-600 text-white" : "bg-emerald-50"}`}
        >
          <div className="text-xs opacity-80">Green</div>
          <div className="mt-2 text-2xl font-semibold">{data?.counts.GREEN || 0}</div>
          <div className="mt-1 text-xs opacity-80">{greenPct}% of portfolio</div>
        </button>

        <button
          onClick={() => setFilter("YELLOW")}
          className={`rounded-2xl border p-5 text-left ${filter === "YELLOW" ? "bg-amber-500 text-white" : "bg-amber-50"}`}
        >
          <div className="text-xs opacity-80">Yellow</div>
          <div className="mt-2 text-2xl font-semibold">{data?.counts.YELLOW || 0}</div>
          <div className="mt-1 text-xs opacity-80">{yellowPct}% of portfolio</div>
        </button>

        <button
          onClick={() => setFilter("RED")}
          className={`rounded-2xl border p-5 text-left ${filter === "RED" ? "bg-red-600 text-white" : "bg-red-50"}`}
        >
          <div className="text-xs opacity-80">Red</div>
          <div className="mt-2 text-2xl font-semibold">{data?.counts.RED || 0}</div>
          <div className="mt-1 text-xs opacity-80">{redPct}% of portfolio</div>
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold">Portfolio Risk Bar</div>
        <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="flex h-full w-full">
            <div className="bg-red-500" style={{ width: `${redPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${yellowPct}%` }} />
            <div className="bg-emerald-500" style={{ width: `${greenPct}%` }} />
            <div
              className="bg-gray-400"
              style={{
                width: `${Math.max(0, 100 - redPct - yellowPct - greenPct)}%`,
              }}
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Red = immediate executive attention. Yellow = watch list. Green = on track.
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Projects</div>
            <div className="text-xs text-muted-foreground">
              Click any card to jump into the live project command center.
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {rows.length} project{rows.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.map((p) => {
            const d = daysTo(p.due_date);
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className={`rounded-2xl border p-4 transition hover:shadow-md ${healthClasses(p.computed_health)}`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{p.name || p.id}</div>
                    <div className="text-xs opacity-80">
                      Stage: {p.stage || "N/A"} • Status: {p.status || "N/A"}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      Start: {fmtDate(p.start_date)} • Due: {fmtDate(p.due_date)}
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-1">
                    <span className="rounded-full border px-3 py-1 text-xs font-semibold bg-white/70">
                      {String(p.computed_health || "UNKNOWN").toUpperCase()}
                    </span>
                    {d !== null ? (
                      <span className="text-xs font-medium">
                        {d < 0 ? `${Math.abs(d)} days overdue` : `${d} days left`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}

          {!rows.length && !busy ? (
            <div className="text-sm text-muted-foreground">No projects found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}