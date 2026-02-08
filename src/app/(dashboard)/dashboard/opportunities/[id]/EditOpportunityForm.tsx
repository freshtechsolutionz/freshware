"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import { SALES_STAGES, SERVICE_LINES, formatServiceLine } from "@/lib/salesConfig";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
};

type FormState = {
  name: string;
  stage: string;
  serviceLine: string;
  amount: string;
};

export default function EditOpportunityForm({ initial }: { initial: Opportunity }) {
  const router = useRouter();

  const defaultStage = useMemo(
    () => initial.stage || SALES_STAGES?.[0] || "new",
    [initial.stage]
  );
  const defaultService = useMemo(
    () => initial.service_line || SERVICE_LINES?.[0] || "",
    [initial.service_line]
  );

  const [form, setForm] = useState<FormState>({
    name: initial.name || "",
    stage: defaultStage,
    serviceLine: defaultService,
    amount: String(initial.amount ?? ""),
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

    if (!name) return setError("Please enter an opportunity name.");
    if (!stage) return setError("Please choose a stage.");
    if (!serviceLine) return setError("Please choose a service line.");

    setSubmitting(true);
    try {
      const res = await fetch(`/api/opportunities/${initial.id}`, {
        method: "PATCH",
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
    <div>
      <PageHeader
        title="Edit Opportunity"
        subtitle="Update fields and keep your pipeline accurate."
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
              inputMode="numeric"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
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
