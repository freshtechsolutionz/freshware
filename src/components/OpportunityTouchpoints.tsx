"use client";

import { useEffect, useMemo, useState } from "react";

type Touchpoint = {
  id: string;
  opportunity_id: string;
  touchpoint_type: string;
  occurred_at: string;
  notes: string | null;
  created_at: string;
};

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
  } catch {
    return iso;
  }
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Momentum score (0-100)
 * - Recency-weighted touchpoints
 * - Type weights
 * - Soft cap so it doesn't inflate forever
 */
function computeMomentumScore(tps: Touchpoint[]) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const typeWeight: Record<string, number> = {
    call: 10,
    email: 6,
    meeting: 14,
    demo: 14,
    proposal_sent: 18,
    follow_up: 10,
    text: 5,
    note: 4,
    contract_sent: 22,
  };

  let score = 0;

  for (const tp of tps) {
    const when = new Date(tp.occurred_at || tp.created_at).getTime();
    const daysAgo = Math.max(0, (now - when) / dayMs);

    // Recency factor (0.2..1.0) – strongest in last 7 days
    const recency =
      daysAgo <= 7 ? 1.0 :
      daysAgo <= 14 ? 0.7 :
      daysAgo <= 30 ? 0.4 :
      0.2;

    const w = typeWeight[(tp.touchpoint_type || "note").toLowerCase()] ?? 4;
    score += w * recency;
  }

  // Soft cap: convert raw score to 0..100
  // raw ~ 120+ should approach 100
  const normalized = Math.round(100 * (1 - Math.exp(-score / 45)));

  return Math.max(0, Math.min(100, normalized));
}

function momentumLabel(score: number) {
  if (score >= 80) return { label: "Hot", cls: "bg-emerald-600 text-white" };
  if (score >= 55) return { label: "Warm", cls: "bg-amber-500 text-white" };
  if (score >= 30) return { label: "Cool", cls: "bg-sky-600 text-white" };
  return { label: "Cold", cls: "bg-zinc-600 text-white" };
}

function chipClass(active: boolean) {
  return [
    "rounded-full px-3 py-1 text-sm border transition",
    active ? "bg-black text-white border-black" : "bg-white hover:bg-zinc-50",
  ].join(" ");
}

export default function OpportunityTouchpoints({
  opportunityId,
  opportunityName,
  amount,
}: {
  opportunityId: string;
  opportunityName: string;
  amount: number;
}) {
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [type, setType] = useState<string>("call");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/touchpoints`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load touchpoints");
      setTouchpoints(json.touchpoints || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load touchpoints");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  async function addTouchpoint(tpType: string, tpNotes?: string) {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/touchpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touchpoint_type: tpType,
          notes: (tpNotes ?? "").trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to add touchpoint");

      // Prepend without refetch for snappy UI
      if (json.touchpoint) {
        setTouchpoints((cur) => [json.touchpoint as Touchpoint, ...cur]);
      } else {
        await load();
      }

      setNotes("");
    } catch (e: any) {
      setErr(e?.message || "Failed to add touchpoint");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (typeFilter === "all") return touchpoints;
    return touchpoints.filter((t) => (t.touchpoint_type || "").toLowerCase() === typeFilter);
  }, [touchpoints, typeFilter]);

  const momentum = useMemo(() => computeMomentumScore(touchpoints), [touchpoints]);
  const badge = useMemo(() => momentumLabel(momentum), [momentum]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of touchpoints) {
      const k = (t.touchpoint_type || "note").toLowerCase();
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [touchpoints]);

  const quick = [
    { t: "call", label: "Call" },
    { t: "email", label: "Email" },
    { t: "meeting", label: "Meeting" },
    { t: "follow_up", label: "Follow-up" },
    { t: "proposal_sent", label: "Proposal Sent" },
    { t: "contract_sent", label: "Contract Sent" },
    { t: "note", label: "Note" },
  ];

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{opportunityName || "Opportunity"}</div>
          <div className="text-sm text-zinc-600">
            Deal Size: <span className="font-semibold text-zinc-900">{money(amount || 0)}</span>
          </div>

          <div className="mt-2 inline-flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${badge.cls}`}>
              Momentum: {momentum}/100 · {badge.label}
            </span>
            <span className="text-xs text-zinc-500">
              based on recency + touchpoint type
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <button
            type="button"
            onClick={load}
            className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <div className="text-xs text-zinc-500">
            Total touchpoints: <span className="font-semibold text-zinc-800">{touchpoints.length}</span>
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {/* Quick add */}
      <div className="mt-4">
        <div className="text-sm font-semibold">Quick add touchpoint</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q.t}
              type="button"
              className="rounded-full border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              disabled={saving}
              onClick={() => addTouchpoint(q.t)}
            >
              + {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom add with notes */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Type</div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            {quick.map((q) => (
              <option key={q.t} value={q.t}>
                {q.label}
              </option>
            ))}
            <option value="demo">Demo</option>
            <option value="text">Text</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-zinc-500 mb-1">Notes (optional)</div>
          <div className="flex gap-2">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? Next step?"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => addTouchpoint(type, notes)}
              disabled={saving}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-zinc-600">
          {loading ? "Loading touchpoints…" : `Showing ${filtered.length} touchpoints`}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={chipClass(typeFilter === "all")} onClick={() => setTypeFilter("all")}>
            All
          </button>
          {typeCounts.slice(0, 6).map(([t, n]) => (
            <button
              key={t}
              type="button"
              className={chipClass(typeFilter === t)}
              onClick={() => setTypeFilter(t)}
            >
              {t} ({n})
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-3 overflow-hidden rounded-2xl border bg-white">
        <div className="divide-y">
          {filtered.map((t) => (
            <div key={t.id} className="p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                    {(t.touchpoint_type || "note").toLowerCase()}
                  </span>
                  <span className="text-xs text-zinc-500">{fmtWhen(t.occurred_at || t.created_at)}</span>
                </div>
              </div>

              {t.notes ? (
                <div className="mt-2 text-sm text-zinc-800 whitespace-pre-wrap">{t.notes}</div>
              ) : (
                <div className="mt-2 text-sm text-zinc-500">—</div>
              )}
            </div>
          ))}

          {!loading && filtered.length === 0 ? (
            <div className="p-4 text-sm text-zinc-600">
              No touchpoints yet. Add a Call/Email/Meeting to start building momentum.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}