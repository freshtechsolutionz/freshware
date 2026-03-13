"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OpportunityTouchpoints from "@/components/OpportunityTouchpoints";
import { SALES_STAGES, STAGE_PROBABILITY, SalesStage, formatServiceLine } from "@/lib/salesConfig";

type Opportunity = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  last_activity_at: string | null;
  created_at: string | null;
  name: string | null;
};

type Account = { id: string; name: string | null } | null;
type Contact = { id: string; name: string | null; email: string | null } | null;

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function prettyLabel(s: string) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function safeStage(s: string | null): SalesStage {
  const v = (s || "new").toLowerCase() as SalesStage;
  return (SALES_STAGES as readonly string[]).includes(v) ? v : "new";
}

export default function OpportunityDetailClient({
  role,
  opportunity,
  account,
  contact,
}: {
  role: string;
  opportunity: Opportunity;
  account: Account;
  contact: Contact;
}) {
  const [stage, setStage] = useState<string>(opportunity.stage || "new");
  const [probability, setProbability] = useState<number | null>(
    opportunity.probability == null ? null : Number(opportunity.probability)
  );

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // rule you requested: use opp.probability if present, otherwise stage base
  const baseProb = useMemo(() => STAGE_PROBABILITY[safeStage(stage)], [stage]);
  const effectiveProb = useMemo(() => (probability == null ? baseProb : probability), [probability, baseProb]);

  const showConvert = useMemo(() => safeStage(stage) === "won", [stage]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          probability: probability == null ? null : Number(probability),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update opportunity");

      setStage(json?.opportunity?.stage ?? stage);
      setProbability(json?.opportunity?.probability == null ? null : Number(json?.opportunity?.probability));
    } catch (e: any) {
      setErr(e?.message || "Failed to update opportunity");
    } finally {
      setSaving(false);
    }
  }

  async function convertToProject() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/convert-to-project`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to convert to project");

      const projectId = json?.project?.id || json?.project_id;
      if (projectId) window.location.href = `/dashboard/projects/${projectId}`;
      else window.location.href = `/dashboard/projects`;
    } catch (e: any) {
      setErr(e?.message || "Failed to convert to project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-xl font-semibold truncate">{opportunity.name || "Untitled Opportunity"}</div>

            <div className="mt-1 text-sm text-zinc-600 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Deal Size:{" "}
                  <span className="font-semibold text-zinc-900">{money(Number(opportunity.amount || 0))}</span>
                </span>
                <span className="text-zinc-300">•</span>
                <span>
                  Service:{" "}
                  <span className="font-semibold text-zinc-900">
                    {opportunity.service_line ? formatServiceLine(opportunity.service_line) : "—"}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Account: <span className="font-semibold text-zinc-900">{account?.name || "—"}</span>
                </span>
                <span className="text-zinc-300">•</span>
                <span>
                  Contact:{" "}
                  <span className="font-semibold text-zinc-900">
                    {contact?.name || contact?.email || "—"}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                Stage: {prettyLabel(stage)}
              </span>
              <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold">
                Probability: {effectiveProb}%{" "}
                <span className="ml-2 font-medium text-zinc-500">
                  {probability == null ? "(stage default)" : "(manual override)"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <Link
              href={`/dashboard/opportunities/${opportunity.id}/edit`}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 text-center"
            >
              Edit Opportunity
            </Link>

            {showConvert ? (
              <button
                type="button"
                onClick={convertToProject}
                disabled={saving}
                className="rounded-xl border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Convert to Project
              </button>
            ) : (
              <div className="text-xs text-zinc-500">
                Convert to Project shows when stage = <span className="font-semibold">Won</span>.
              </div>
            )}
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Stage</div>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              {SALES_STAGES.map((s) => (
                <option key={s} value={s}>
                  {prettyLabel(s)}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">
              Default probability for this stage: <span className="font-semibold">{baseProb}%</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 mb-1">Probability override (optional)</div>
            <input
              type="number"
              min={0}
              max={100}
              value={probability == null ? "" : String(probability)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return setProbability(null);
                setProbability(Math.max(0, Math.min(100, Number(v) || 0)));
              }}
              placeholder={`${baseProb}`}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="mt-1 text-xs text-zinc-500">Leave blank to use the stage default.</div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <OpportunityTouchpoints
        opportunityId={opportunity.id}
        opportunityName={opportunity.name || "Opportunity"}
        amount={Number(opportunity.amount || 0)}
      />
    </div>
  );
}