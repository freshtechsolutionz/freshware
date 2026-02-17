"use client";

import { useEffect, useState } from "react";

type ProbeResult = {
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  statusText: string | null;
  redirected: boolean;
  finalUrl: string | null;
  locationHeader: string | null;
  bodySnippet: string | null;
  error: string | null;
};

async function probeOnce(label: string, url: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      redirect: "manual",
      headers: {
        "x-freshware-probe": "1",
      },
    });

    const locationHeader = res.headers.get("location");
    let bodySnippet: string | null = null;

    try {
      const text = await res.text();
      bodySnippet = text ? text.slice(0, 600) : "";
    } catch {
      bodySnippet = null;
    }

    return {
      label,
      url,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText || null,
      redirected: res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400),
      finalUrl: res.url || null,
      locationHeader,
      bodySnippet,
      error: null,
    };
  } catch (e: any) {
    return {
      label,
      url,
      ok: false,
      status: null,
      statusText: null,
      redirected: false,
      finalUrl: null,
      locationHeader: null,
      bodySnippet: null,
      error: e?.message || String(e),
    };
  }
}

export default function ApiProbe(props: { paths: string[] }) {
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const origin =
        typeof window !== "undefined" && window.location ? window.location.origin : "";

      const jobs: Promise<ProbeResult>[] = [];
      for (const p of props.paths) {
        jobs.push(probeOnce(`relative: ${p}`, p));
        if (origin) jobs.push(probeOnce(`absolute: ${origin}${p}`, `${origin}${p}`));
      }

      const out = await Promise.all(jobs);
      setResults(out);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">API Probe (debug)</div>
          <div className="text-xs text-muted-foreground">
            This shows the real status, redirects, and response body.
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? "Probing..." : "Re-run probe"}
        </button>
      </div>

      {!results ? (
        <div className="mt-3 text-sm text-muted-foreground">Running…</div>
      ) : (
        <div className="mt-3 space-y-3">
          {results.map((r, idx) => (
            <div key={idx} className="rounded-2xl border p-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold">{r.label}</div>
                <div className="text-xs text-muted-foreground">
                  {r.status === null ? "NO RESPONSE" : `HTTP ${r.status} ${r.statusText || ""}`}
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground break-all">{r.url}</div>

              {r.error ? (
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  Fetch error: {r.error}
                </div>
              ) : null}

              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <div className="rounded-2xl border p-2">
                  <div className="text-[11px] text-muted-foreground">ok</div>
                  <div className="text-sm font-semibold">{String(r.ok)}</div>
                </div>
                <div className="rounded-2xl border p-2">
                  <div className="text-[11px] text-muted-foreground">redirected</div>
                  <div className="text-sm font-semibold">{String(r.redirected)}</div>
                </div>
                <div className="rounded-2xl border p-2">
                  <div className="text-[11px] text-muted-foreground">location header</div>
                  <div className="text-xs font-semibold break-all">{r.locationHeader || "N/A"}</div>
                </div>
              </div>

              <div className="mt-2 rounded-2xl border p-2">
                <div className="text-[11px] text-muted-foreground">body (first 600 chars)</div>
                <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
                  {r.bodySnippet === null ? "N/A" : r.bodySnippet}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
