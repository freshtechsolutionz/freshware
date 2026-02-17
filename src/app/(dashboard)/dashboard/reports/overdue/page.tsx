"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ApiProbe from "@/components/dashboard/ApiProbe";

type OverdueTask = {
  task_id: string;
  title: string | null;
  status: string | null;
  due_at: string | null;
  assigned_to: string | null;
  assignee_name?: string | null;
  project_id: string | null;
};

type OverdueResponse = {
  now: string;
  counts: { overdue: number; blocked: number };
  overdue: OverdueTask[];
  blocked: OverdueTask[];
};

function fmtDate(s: string | null | undefined) {
  if (!s) return "N/A";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
}

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

export default function OverdueReportPage() {
  const [data, setData] = useState<OverdueResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const json = (await fetchJson("/api/ceo/overdue")) as OverdueResponse;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Unable to reach /api/ceo/overdue");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const overdue = data?.overdue || [];
  const blocked = data?.blocked || [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Reports</div>
            <div className="text-xl font-semibold">Overdue Tasks</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Source: <span className="font-medium">/api/ceo/overdue</span>
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

        {data ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border p-4">
              <div className="text-xs text-muted-foreground">As of</div>
              <div className="mt-1 text-sm font-semibold">{fmtDate(data.now)}</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs text-muted-foreground">Overdue</div>
              <div className="mt-1 text-2xl font-semibold">{data.counts?.overdue ?? overdue.length}</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs text-muted-foreground">Blocked</div>
              <div className="mt-1 text-2xl font-semibold">{data.counts?.blocked ?? blocked.length}</div>
            </div>
          </div>
        ) : null}
      </div>

      <ApiProbe paths={["/api/ceo/overdue"]} />

      <div className="rounded-2xl border bg-background p-5">
        <div className="text-sm font-semibold">Overdue</div>
        <div className="mt-3 space-y-2">
          {overdue.map((t) => (
            <div key={t.task_id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold">{t.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground">
                  Status: {t.status || "N/A"} | Due: {fmtDate(t.due_at)}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Assignee: {t.assignee_name || t.assigned_to || "Unassigned"} | Project: {t.project_id || "N/A"}
              </div>
            </div>
          ))}
          {!overdue.length && !busy ? <div className="text-sm text-muted-foreground">No overdue tasks.</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-5">
        <div className="text-sm font-semibold">Blocked</div>
        <div className="mt-3 space-y-2">
          {blocked.map((t) => (
            <div key={t.task_id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold">{t.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground">
                  Status: {t.status || "N/A"} | Due: {fmtDate(t.due_at)}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Assignee: {t.assignee_name || t.assigned_to || "Unassigned"} | Project: {t.project_id || "N/A"}
              </div>
            </div>
          ))}
          {!blocked.length && !busy ? <div className="text-sm text-muted-foreground">No blocked tasks.</div> : null}
        </div>
      </div>
    </div>
  );
}
