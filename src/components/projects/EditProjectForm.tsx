"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ProjectRow = {
  id: string;
  opportunity_id: string | null;
  name: string | null;
  status: string | null;
  stage: string | null;
  start_date: string | null;
  due_date: string | null;
  support_cost: number | null;
  support_due_date: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  health: string | null;
  account_id: string | null;
  description: string | null;
  internal_notes: string | null;
};

type FinancialsRow = {
  id: string;
  project_id: string;
  account_id: string;
  budget_total: number | null;
  cost_to_date: number | null;
  billed_to_date: number | null;
  paid_to_date: number | null;
  currency: string;
  updated_at: string;
  created_at: string;
} | null;

type Option = {
  id: string;
  label: string;
};

function dateInputValue(v: string | null | undefined) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function currencyPreview(v: string, code: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "N/A";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}

const PROJECT_STAGE_OPTIONS = [
  "Intake",
  "Planning",
  "Design",
  "Development",
  "QA",
  "Launch",
  "Support",
] as const;

const PROJECT_STATUS_OPTIONS = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "canceled",
] as const;

const HEALTH_OPTIONS = ["GREEN", "YELLOW", "RED", "UNKNOWN"] as const;

export default function EditProjectForm({
  initial,
  initialFinancials,
  ownerOptions,
  opportunityOptions,
}: {
  initial: ProjectRow;
  initialFinancials: FinancialsRow;
  ownerOptions: Option[];
  opportunityOptions: Option[];
}) {
  const router = useRouter();

  const [name, setName] = useState(initial.name || "");
  const [status, setStatus] = useState(initial.status || "active");
  const [stage, setStage] = useState(initial.stage || "Planning");
  const [health, setHealth] = useState(initial.health || "GREEN");
  const [startDate, setStartDate] = useState(dateInputValue(initial.start_date));
  const [dueDate, setDueDate] = useState(dateInputValue(initial.due_date));
  const [supportCost, setSupportCost] = useState(
    initial.support_cost == null ? "" : String(initial.support_cost)
  );
  const [supportDueDate, setSupportDueDate] = useState(
    dateInputValue(initial.support_due_date)
  );
  const [ownerUserId, setOwnerUserId] = useState(initial.owner_user_id || "");
  const [opportunityId, setOpportunityId] = useState(initial.opportunity_id || "");
  const [description, setDescription] = useState(initial.description || "");
  const [internalNotes, setInternalNotes] = useState(initial.internal_notes || "");

  const [budgetTotal, setBudgetTotal] = useState(
    initialFinancials?.budget_total == null ? "" : String(initialFinancials.budget_total)
  );
  const [costToDate, setCostToDate] = useState(
    initialFinancials?.cost_to_date == null ? "" : String(initialFinancials.cost_to_date)
  );
  const [billedToDate, setBilledToDate] = useState(
    initialFinancials?.billed_to_date == null ? "" : String(initialFinancials.billed_to_date)
  );
  const [paidToDate, setPaidToDate] = useState(
    initialFinancials?.paid_to_date == null ? "" : String(initialFinancials.paid_to_date)
  );
  const [currency, setCurrency] = useState(initialFinancials?.currency || "USD");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const timeline = useMemo(() => {
    if (!startDate || !dueDate) return { has: false, pct: 0, daysLeft: null as number | null };
    const start = new Date(startDate);
    const due = new Date(dueDate);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(due.getTime())) {
      return { has: false, pct: 0, daysLeft: null as number | null };
    }

    const total = Math.max(1, daysBetween(start, due));
    const elapsed = clamp(daysBetween(start, now), 0, total);
    const pct = clamp(Math.round((elapsed / total) * 100), 0, 100);
    const daysLeft = daysBetween(now, due);

    return { has: true, pct, daysLeft };
  }, [startDate, dueDate]);

  const supportInfo = useMemo(() => {
    if (!supportDueDate) return { has: false, daysLeft: null as number | null };
    const due = new Date(supportDueDate);
    const now = new Date();
    if (isNaN(due.getTime())) return { has: false, daysLeft: null as number | null };
    return { has: true, daysLeft: daysBetween(now, due) };
  }, [supportDueDate]);

  async function onSave() {
    setErr(null);
    setBusy(true);

    try {
      const projectRes = await fetch(`/api/projects/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          status: status || null,
          stage: stage || null,
          health: health || null,
          start_date: startDate || null,
          due_date: dueDate || null,
          support_cost: supportCost,
          support_due_date: supportDueDate || null,
          owner_user_id: ownerUserId || null,
          opportunity_id: opportunityId || null,
          description: description.trim() || null,
          internal_notes: internalNotes.trim() || null,
        }),
      });

      const projectJson = await projectRes.json().catch(() => ({}));
      if (!projectRes.ok) {
        throw new Error(projectJson?.error || "Failed to save project");
      }

      const finRes = await fetch(`/api/projects/${initial.id}/financials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_total: budgetTotal,
          cost_to_date: costToDate,
          billed_to_date: billedToDate,
          paid_to_date: paidToDate,
          currency: (currency || "USD").toUpperCase(),
        }),
      });

      const finJson = await finRes.json().catch(() => ({}));
      if (!finRes.ok) {
        throw new Error(finJson?.error || "Failed to save financials");
      }

      router.push(`/dashboard/projects/${initial.id}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to save project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm xl:col-span-2 space-y-4">
          <div className="text-sm font-semibold">Project Core</div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Project name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {PROJECT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {PROJECT_STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Health</label>
              <select
                value={health}
                onChange={(e) => setHealth(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {HEALTH_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Owner</label>
              <select
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {ownerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Linked opportunity</label>
              <select
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {opportunityOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Support cost</label>
              <input
                value={supportCost}
                onChange={(e) => setSupportCost(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="e.g. 2500"
              />
              <div className="text-xs text-muted-foreground">
                {currencyPreview(supportCost, currency)}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Support due date</label>
              <input
                type="date"
                value={supportDueDate}
                onChange={(e) => setSupportDueDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Internal notes</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="text-sm font-semibold">Progress Preview</div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">Timeline Progress</div>
            <div className="mt-2 h-3 w-full rounded-full bg-gray-100">
              <div
                className="h-3 rounded-full bg-gray-900"
                style={{ width: `${timeline.has ? timeline.pct : 0}%` }}
              />
            </div>
            <div className="mt-2 text-sm font-semibold">
              {timeline.has ? `${timeline.pct}% elapsed` : "Add dates to calculate progress"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {timeline.has ? `${timeline.daysLeft} days left` : "No timeline yet"}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">Support Window</div>
            <div className="mt-2 text-sm font-semibold">
              {supportInfo.has ? `${supportInfo.daysLeft} days left` : "No support date set"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Support Cost: {currencyPreview(supportCost, currency)}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">Health</div>
            <div className="mt-2 text-lg font-semibold">{health}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              This feeds your project heat map and executive reporting.
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">Status / Stage</div>
            <div className="mt-2 text-sm">
              {status} • {stage}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div className="text-sm font-semibold">Financial Controls</div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-sm font-medium">Budget</label>
            <input
              value={budgetTotal}
              onChange={(e) => setBudgetTotal(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">{currencyPreview(budgetTotal, currency)}</div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Cost to date</label>
            <input
              value={costToDate}
              onChange={(e) => setCostToDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">{currencyPreview(costToDate, currency)}</div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Billed</label>
            <input
              value={billedToDate}
              onChange={(e) => setBilledToDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">{currencyPreview(billedToDate, currency)}</div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Paid</label>
            <input
              value={paidToDate}
              onChange={(e) => setPaidToDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">{currencyPreview(paidToDate, currency)}</div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save Project"}
          </button>

          <Link
            href={`/dashboard/projects/${initial.id}`}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}