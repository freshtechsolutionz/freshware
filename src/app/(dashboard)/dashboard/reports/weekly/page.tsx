"use client";

import { useEffect, useState } from "react";

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    const txt = await res.text();
    throw new Error(`Non-JSON response (${res.status}). ${txt.slice(0, 180)}`);
  }
  return res.json();
}

export default function WeeklyReportPage() {
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ceo/weekly-report", { cache: "no-store" });
      const data = await safeJson(res);
      if (data?.error) throw new Error(data.error);
      setText(String(data.text || ""));
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Weekly Executive Report</div>
          <div className="mt-1 text-sm text-zinc-600">Auto-generated summary for leadership focus.</div>
        </div>

        <div className="flex gap-2">
          <button onClick={load} className="fw-btn text-sm" disabled={busy} type="button">
            {busy ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(text || "");
              setToast("Copied");
            }}
            className="fw-btn text-sm"
            disabled={!text}
            type="button"
          >
            Copy
          </button>
        </div>
      </div>

      {toast ? <div className="fw-card-strong p-4 text-sm font-semibold text-zinc-900">{toast}</div> : null}
      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : null}

      <div className="fw-card-strong p-7">
        <div className="text-sm font-semibold text-zinc-900">Report Output</div>
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
          <pre className="m-0 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-900">
            {text || (busy ? "Generating..." : "No report returned.")}
          </pre>
        </div>
      </div>
    </div>
  );
}
