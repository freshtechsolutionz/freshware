"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import OpportunityTouchpoints from "@/components/OpportunityTouchpoints";
import {
  SALES_STAGES,
  SERVICE_LINES,
  formatServiceLine,
  STAGE_PROBABILITY,
  type SalesStage,
  type ServiceLine,
} from "@/lib/salesConfig";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;

  probability: number | null;
  last_activity_at: string | null;
  created_at: string | null;
};

type FormState = {
  name: string;
  stage: SalesStage;
  serviceLine: ServiceLine;
  amount: string;

  probabilityOverrideEnabled: boolean;
  probability: string; // input controlled
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
  } catch {
    return iso;
  }
}

function clamp01_100(n: number) {
  return Math.max(0, Math.min(100, n));
}

function asSalesStage(v: string | null | undefined): SalesStage {
  const s = (v || "new") as SalesStage;
  return SALES_STAGES.includes(s) ? s : "new";
}

function asServiceLine(v: string | null | undefined): ServiceLine {
  const s = (v || "apps") as ServiceLine;
  return SERVICE_LINES.includes(s) ? s : "apps";
}

export default function EditOpportunityForm({ initial }: { initial: Opportunity }) {
  const router = useRouter();

  const defaultStage = useMemo(() => asSalesStage(initial.stage), [initial.stage]);
  const defaultService = useMemo(() => asServiceLine(initial.service_line), [initial.service_line]);

  const stageDefaultProb = STAGE_PROBABILITY[defaultStage];

  // If stored probability differs from stage default, treat as manual override
  const initialProb = initial.probability;
  const overrideEnabled =
    initialProb != null && Number(initialProb) !== stageDefaultProb;

  const [form, setForm] = useState<FormState>({
    name: initial.name || "",
    stage: defaultStage,
    serviceLine: defaultService,
    amount: String(initial.amount ?? ""),

    probabilityOverrideEnabled: overrideEnabled,
    probability: String(initialProb ?? stageDefaultProb),
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const suggestedProb = STAGE_PROBABILITY[form.stage];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const stage = form.stage;
    const serviceLine = form.serviceLine;
    const amountStr = form.amount.trim();

    if (!name) return setError("Please enter an opportunity name.");

    // Probability:
    // - override enabled -> numeric
    // - else -> null so DB trigger uses stage default
    let probability: number | null = null;

    if (form.probabilityOverrideEnabled) {
      const p = Number(form.probability);
      probability = clamp01_100(Number.isFinite(p) ? p : suggestedProb);
    } else {
      probability = null;
    }

    const amount = amountStr === "" ? 0 : Number(amountStr) || 0;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/opportunities/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          stage,
          serviceLine,
          amount,
          probability,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to update opportunity.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard/opportunities");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error updating opportunity.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Opportunity"
        subtitle="Update fields and keep your pipeline accurate."
        right={
          <Link href="/dashboard/opportunities" className="rounded-lg border px-3 py-2 text-sm">
            Back to Opportunities
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-2xl border bg-background p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Opportunity name</label>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Stage</label>
                <select
                  value={form.stage}
                  onChange={(e) => setField("stage", e.target.value as SalesStage)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {SALES_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <div className="text-xs text-muted-foreground">
                  Stage default probability: <b>{suggestedProb}%</b>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Service line</label>
                <select
                  value={form.serviceLine}
                  onChange={(e) => setField("serviceLine", e.target.value as ServiceLine)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {SERVICE_LINES.map((s) => (
                    <option key={s} value={s}>
                      {formatServiceLine(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Amount</label>
                <input
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Probability</label>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.probabilityOverrideEnabled}
                    onChange={(e) => setField("probabilityOverrideEnabled", e.target.checked)}
                  />
                  <div className="text-sm">
                    Manual override{" "}
                    <span className="text-xs text-muted-foreground">(otherwise stage default)</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={form.probability}
                    onChange={(e) => setField("probability", e.target.value)}
                    disabled={!form.probabilityOverrideEnabled}
                    inputMode="numeric"
                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                    placeholder={`${suggestedProb}`}
                  />
                  <div className="text-sm font-semibold text-zinc-700">%</div>
                </div>

                {!form.probabilityOverrideEnabled ? (
                  <div className="text-xs text-muted-foreground">
                    Saving will reset probability to <b>{suggestedProb}%</b>.
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-2 text-xs underline text-zinc-700"
                    onClick={() => setField("probability", String(suggestedProb))}
                  >
                    Reset input to stage default
                  </button>
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save changes"}
              </button>

              <Link href="/dashboard/opportunities" className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Details */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Opportunity Details</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-zinc-500">Current stage</div>
              <div className="mt-1 text-lg font-semibold">{initial.stage || "—"}</div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-zinc-500">Current probability</div>
              <div className="mt-1 text-lg font-semibold">{initial.probability ?? suggestedProb}%</div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-zinc-500">Created</div>
              <div className="mt-1 text-sm font-semibold">{fmtDateTime(initial.created_at)}</div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-zinc-500">Last activity</div>
              <div className="mt-1 text-sm font-semibold">{fmtDateTime(initial.last_activity_at)}</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            Tip: Momentum comes from touchpoints. Use them consistently and your forecasts get real.
          </div>
        </div>
      </div>

      {/* Touchpoints */}
      <OpportunityTouchpoints
        opportunityId={initial.id}
        opportunityName={initial.name || ""}
        amount={Number(initial.amount || 0)}
      />
    </div>
  );
}