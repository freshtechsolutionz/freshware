"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import { SALES_STAGES, SERVICE_LINES, formatServiceLine } from "@/lib/salesConfig";

type FormState = {
  name: string;
  stage: string;
  serviceLine: string;
  amount: string; // keep as string for input control
};

export default function NewOpportunityForm() {
  const router = useRouter();

  const defaultStage = useMemo(() => SALES_STAGES?.[0] || "new", []);
  const defaultService = useMemo(() => SERVICE_LINES?.[0] || "", []);

  const [form, setForm] = useState<FormState>({
    name: "",
    stage: defaultStage,
    serviceLine: defaultService,
    amount: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const stage = form.stage;
    const serviceLine = form.serviceLine;
    const amount = form.amount.trim();

    if (!name) {
      setError("Please enter an opportunity name.");
      return;
    }
    if (!stage) {
      setError("Please choose a stage.");
      return;
    }
    if (!serviceLine) {
      setError("Please choose a service line.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          stage,
          serviceLine,
          amount: amount === "" ? 0 : Number(amount),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Failed to create opportunity.");
        setSubmitting(false);
        return;
      }

      // Success: go back to dashboard list
      router.push("/dashboard/opportunities");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating opportunity.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Opportunity"
        subtitle="Create a new opportunity in your pipeline."
        right={
          <Link href="/dashboard/opportunities" className="rounded-lg border px-3 py-2 text-sm">
            Back to Opportunities
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Opportunity name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g., Heights Chamber App Upgrade"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setField("stage", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {SALES_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Service line</label>
              <select
                value={form.serviceLine}
                onChange={(e) => setField("serviceLine", e.target.value)}
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

          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <input
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="e.g., 15000"
              inputMode="numeric"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">
              Leave blank to default to 0.
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
              {submitting ? "Creating..." : "Create opportunity"}
            </button>

            <Link
              href="/dashboard/opportunities"
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
