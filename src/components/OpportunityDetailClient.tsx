"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OpportunityTouchpoints from "@/components/OpportunityTouchpoints";
import {
  SALES_STAGES,
  STAGE_PROBABILITY,
  SalesStage,
  formatServiceLine,
} from "@/lib/salesConfig";

type Opportunity = {
  id: string;
  account_id: string | null;
  company_id: string | null;
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
type Company = { id: string; name: string | null; website: string | null; industry: string | null } | null;

function money(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function prettyLabel(s: string) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function safeStage(s: string | null): SalesStage {
  const v = (s || "new").toLowerCase() as SalesStage;
  return (SALES_STAGES as readonly string[]).includes(v) ? v : "new";
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "N/A";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function daysSince(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function chipClass(stage: string | null | undefined) {
  const s = String(stage || "").toLowerCase();
  if (s === "won") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "lost") return "border-red-200 bg-red-50 text-red-700";
  if (s === "proposal" || s === "negotiation") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default function OpportunityDetailClient({
  role,
  opportunity,
  account,
  contact,
  company,
}: {
  role: string;
  opportunity: Opportunity;
  account: Account;
  contact: Contact;
  company: Company;
}) {
  const [stage, setStage] = useState<string>(opportunity.stage || "new");
  const [probability, setProbability] = useState<number | null>(
    opportunity.probability == null ? null : Number(opportunity.probability)
  );

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canWrite = useMemo(() => {
    const r = String(role || "").toUpperCase();
    return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
  }, [role]);

  const baseProb = useMemo(() => STAGE_PROBABILITY[safeStage(stage)], [stage]);
  const effectiveProb = useMemo(
    () => (probability == null ? baseProb : probability),
    [probability, baseProb]
  );

  const weightedAmount = useMemo(() => {
    const amount = Number(opportunity.amount || 0);
    const p = Number(effectiveProb || 0);
    const norm = p > 1 ? p / 100 : p;
    return amount * norm;
  }, [effectiveProb, opportunity.amount]);

  const showConvert = useMemo(() => safeStage(stage) === "won", [stage]);

  const inactivityDays = useMemo(() => {
    return daysSince(opportunity.last_activity_at || opportunity.created_at);
  }, [opportunity.last_activity_at, opportunity.created_at]);

  async function save() {
    setErr(null);
    setOk(null);
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
      setProbability(
        json?.opportunity?.probability == null
          ? null
          : Number(json?.opportunity?.probability)
      );
      setOk("Opportunity updated.");
    } catch (e: any) {
      setErr(e?.message || "Failed to update opportunity");
    } finally {
      setSaving(false);
    }
  }

  async function convertToProject() {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/convert-to-project`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to convert opportunity to project");

      setOk("Opportunity converted to project.");
      if (json?.project?.id) {
        window.location.href = `/dashboard/projects/${json.project.id}`;
        return;
      }
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || "Failed to convert opportunity to project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-gray-900">
              {opportunity.name || "Unnamed Opportunity"}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {formatServiceLine(opportunity.service_line || "")} · Account: {account?.name || "N/A"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/opportunities" className="fw-btn text-sm">
              Back to Opportunities
            </Link>
            {company?.id ? (
              <Link href={`/dashboard/companies/${company.id}`} className="fw-btn text-sm">
                Open Company 360
              </Link>
            ) : null}
            {canWrite ? (
              <Link href={`/dashboard/opportunities/${opportunity.id}/edit`} className="fw-btn text-sm">
                Edit Form
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass(stage)}`}>
            {prettyLabel(stage)}
          </span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
            Probability: {effectiveProb}%
          </span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
            Weighted: {money(weightedAmount)}
          </span>
          {inactivityDays != null ? (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              {inactivityDays} day(s) since activity
            </span>
          ) : null}
        </div>

        {ok ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {ok}
          </div>
        ) : null}

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Amount" value={money(Number(opportunity.amount || 0))} sub="Raw deal value" />
        <MetricCard title="Weighted" value={money(weightedAmount)} sub="Probability-adjusted" />
        <MetricCard title="Stage" value={prettyLabel(stage)} sub="Current pipeline position" />
        <MetricCard title="Close Date" value={fmtDate(opportunity.close_date)} sub="Expected close" />
        <MetricCard title="Created" value={fmtDate(opportunity.created_at)} sub="Deal opened" />
        <MetricCard title="Last Activity" value={fmtDate(opportunity.last_activity_at)} sub="Most recent touch" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Executive Snapshot</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard title="Account" value={account?.name || "N/A"} />
            <InfoCard title="Contact" value={contact?.name || "N/A"} />
            <InfoCard title="Contact Email" value={contact?.email || "N/A"} />
            <InfoCard title="Company" value={company?.name || "N/A"} />
            <InfoCard title="Industry" value={company?.industry || "N/A"} />
            <InfoCard title="Website" value={company?.website || "N/A"} />
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Stage + Probability Control</div>
          <div className="mt-1 text-sm text-gray-600">
            Update the live sales position without leaving the detail page.
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                disabled={!canWrite}
                className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60"
              >
                {SALES_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {prettyLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Probability %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={probability == null ? "" : String(probability)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setProbability(v ? Number(v) : null);
                }}
                disabled={!canWrite}
                className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm disabled:opacity-60"
                placeholder={String(baseProb)}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!canWrite || saving}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Opportunity"}
            </button>

            {showConvert && canWrite ? (
              <button
                type="button"
                onClick={convertToProject}
                disabled={saving}
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Working..." : "Convert to Project"}
              </button>
            ) : null}

            {opportunity.id ? (
              <Link
                href={`/dashboard/opportunities/${opportunity.id}/meetings`}
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold"
              >
                Opportunity Meetings
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-gray-900">Touchpoints</div>
        <div className="mt-1 text-sm text-gray-600">
          Track every meaningful movement so the opportunity never goes stale silently.
        </div>

        <div className="mt-5">
          <OpportunityTouchpoints
            opportunityId={opportunity.id}
            opportunityName={opportunity.name || "Unnamed Opportunity"}
            amount={Number(opportunity.amount || 0)}
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard(props: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-xs text-gray-500">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      <div className="mt-1 text-sm text-gray-600">{props.sub}</div>
    </div>
  );
}

function InfoCard(props: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <div className="text-xs font-semibold text-gray-500">{props.title}</div>
      <div className="mt-2 break-words text-sm text-gray-900">{props.value}</div>
    </div>
  );
}