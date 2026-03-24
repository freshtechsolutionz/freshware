"use client";

import { useEffect, useMemo, useState } from "react";
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

type Company = {
  id: string;
  name: string | null;
};

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  company_id: string | null;
};

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  probability: number | null;
  close_date?: string | null;
  last_activity_at: string | null;
  created_at: string | null;
  company_id?: string | null;
  contact_id?: string | null;
};

type FormState = {
  name: string;
  stage: SalesStage;
  serviceLine: ServiceLine;
  amount: string;
  close_date: string;
  company_id: string;
  contact_id: string;
  probabilityOverrideEnabled: boolean;
  probability: string;
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

function dateInputValue(v: string | null | undefined) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

export default function EditOpportunityForm({
  initial,
  canDelete,
}: {
  initial: Opportunity;
  canDelete: boolean;
}) {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const defaultStage = useMemo(() => asSalesStage(initial.stage), [initial.stage]);
  const defaultService = useMemo(() => asServiceLine(initial.service_line), [initial.service_line]);

  const stageDefaultProb = STAGE_PROBABILITY[defaultStage];
  const initialProb = initial.probability;
  const overrideEnabled = initialProb != null && Number(initialProb) !== stageDefaultProb;

  const [form, setForm] = useState<FormState>({
    name: initial.name || "",
    stage: defaultStage,
    serviceLine: defaultService,
    amount: String(initial.amount ?? ""),
    close_date: dateInputValue(initial.close_date || null),
    company_id: initial.company_id || "",
    contact_id: initial.contact_id || "",
    probabilityOverrideEnabled: overrideEnabled,
    probability: String(initialProb ?? stageDefaultProb),
  });

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((j) => setCompanies(j.companies || []))
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));

    fetch("/api/contacts")
      .then((r) => r.json())
      .then((j) => setContacts(j.contacts || []))
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "company_id" && prev.company_id !== value) {
        next.contact_id = "";
      }
      return next;
    });
  }

  const filteredContacts = useMemo(() => {
    if (!form.company_id) return contacts;
    return contacts.filter((c) => c.company_id === form.company_id);
  }, [contacts, form.company_id]);

  const suggestedProb = STAGE_PROBABILITY[form.stage];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const stage = form.stage;
    const serviceLine = form.serviceLine;
    const amountStr = form.amount.trim();

    if (!name) return setError("Please enter an opportunity name.");
    if (!form.company_id) return setError("Please select a company profile.");

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
          close_date: form.close_date || null,
          company_id: form.company_id || null,
          contact_id: form.contact_id || null,
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

  async function handleDeleteOpportunity() {
    const confirmed = window.confirm(
      "Delete this opportunity? This will soft-delete the opportunity and also remove opportunity-linked tasks and revenue entries. This is useful for cleaning up test data."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/opportunities/${initial.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete opportunity.");
      }

      router.push("/dashboard/opportunities");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to delete opportunity.");
      setDeleting(false);
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">Company Profile</label>
                  <Link
                    href="/dashboard/companies?new=1"
                    className="text-xs font-semibold text-blue-700 underline underline-offset-4"
                  >
                    + Create New Company
                  </Link>
                </div>
                <select
                  value={form.company_id}
                  onChange={(e) => setField("company_id", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  disabled={loadingCompanies}
                >
                  <option value="">— Select company —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Untitled Company"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Primary Contact</label>
                <select
                  value={form.contact_id}
                  onChange={(e) => setField("contact_id", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  disabled={loadingContacts}
                >
                  <option value="">— Optional contact —</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Unnamed Contact"}{c.email ? ` (${c.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
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
                <label className="text-sm font-medium">Close date</label>
                <input
                  type="date"
                  value={form.close_date}
                  onChange={(e) => setField("close_date", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
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
                  className="mt-2 text-xs text-zinc-700 underline"
                  onClick={() => setField("probability", String(suggestedProb))}
                >
                  Reset input to stage default
                </button>
              )}
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

          {canDelete ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-sm font-semibold text-red-900">Danger Zone</div>
              <div className="mt-1 text-sm text-red-800">
                Delete this opportunity and clean up opportunity-linked revenue and tasks.
              </div>
              <button
                type="button"
                onClick={handleDeleteOpportunity}
                disabled={deleting}
                className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Opportunity"}
              </button>
            </div>
          ) : null}
        </div>

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

      <OpportunityTouchpoints
        opportunityId={initial.id}
        opportunityName={initial.name || ""}
        amount={Number(initial.amount || 0)}
      />
    </div>
  );
}