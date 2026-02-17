"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";


type PipelineResponse = {
  range_days: number;
  since: string;
  total_opportunities: number;
  byStage: Record<string, { count: number; totalAmount: number }>;
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

export default function PipelineReportPage() {
  const [range, setRange] = useState("30");
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const json = (await fetchJson(`/api/ceo/pipeline?range=${encodeURIComponent(range)}`)) as PipelineResponse;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Unable to reach pipeline API");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageRows = useMemo(() => {
    const by = data?.byStage || {};
    return Object.keys(by)
      .map((k) => ({ stage: k, count: by[k].count, totalAmount: by[k].totalAmount }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Reports</div>
            <div className="text-xl font-semibold">Pipeline Drilldown</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Source: <span className="font-medium">/api/ceo/pipeline</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              Back to Dashboard
            </Link>

            <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
            </select>

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
        <div className="text-sm font-semibold">By Stage</div>
        <div className="mt-3 space-y-2">
          {stageRows.map((r) => (
            <div key={r.stage} className="rounded-2xl border p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{r.stage}</div>
                <div className="text-xs text-muted-foreground">{r.count} opportunities</div>
              </div>
              <div className="text-sm font-semibold">
                {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                  r.totalAmount || 0
                )}
              </div>
            </div>
          ))}
          {!stageRows.length && !busy ? <div className="text-sm text-muted-foreground">No pipeline data.</div> : null}
        </div>
      </div>
    </div>
  );
}
