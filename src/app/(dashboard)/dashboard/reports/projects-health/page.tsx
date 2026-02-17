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

export default function ProjectsHealthReportPage() {
  const [data, setData] = useState<ProjectsHealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const sorted = useMemo(() => {
    const rows = data?.projects || [];
    const weight: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, UNKNOWN: 3 };
    return [...rows].sort((a, b) => (weight[a.computed_health] ?? 9) - (weight[b.computed_health] ?? 9));
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Reports</div>
            <div className="text-xl font-semibold">Project Health Heatmap</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Source: <span className="font-medium">/api/ceo/projects-health</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              Back to Dashboard
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

   

      <div className="rounded-2xl border bg-background p-5">
        <div className="text-sm font-semibold">Projects</div>
        <div className="mt-3 space-y-2">
          {sorted.map((p) => (
            <div key={p.id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{p.name || p.id}</div>
                  <div className="text-xs text-muted-foreground">
                    Stage: {p.stage || "N/A"} | Status: {p.status || "N/A"} | Start: {fmtDate(p.start_date)} | Due:{" "}
                    {fmtDate(p.due_date)}
                  </div>
                </div>
                <div className="text-sm font-semibold">{p.computed_health}</div>
              </div>
            </div>
          ))}
          {!sorted.length && !busy ? <div className="text-sm text-muted-foreground">No projects found.</div> : null}
        </div>
      </div>
    </div>
  );
}
