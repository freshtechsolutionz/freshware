"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
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

type FormState = {
  name: string;
  stage: SalesStage;
  serviceLine: ServiceLine;
  amount: string;
  company_id: string;
  contact_id: string;
};

export default function NewOpportunityForm() {
  const router = useRouter();

  const defaultStage = useMemo(() => (SALES_STAGES?.[0] || "new") as SalesStage, []);
  const defaultService = useMemo(() => (SERVICE_LINES?.[0] || "apps") as ServiceLine, []);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const [form, setForm] = useState<FormState>({
    name: "",
    stage: defaultStage,
    serviceLine: defaultService,
    amount: "",
    company_id: "",
    contact_id: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const stage = form.stage;
    const serviceLine = form.serviceLine;
    const amount = form.amount.trim();

    if (!name) return setError("Please enter an opportunity name.");
    if (!form.company_id) return setError("Please select a company profile.");

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
          company_id: form.company_id || null,
          contact_id: form.contact_id || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to create opportunity.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard/opportunities");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating opportunity.");
      setSubmitting(false);
    }
  }

  const suggestedProb = STAGE_PROBABILITY[form.stage];

  return (
    <div>
      <PageHeader
        title="New Opportunity"
        subtitle="Create a new opportunity in your pipeline and tie it to a company."
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
              <label className="text-sm font-medium">Company Profile</label>
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
                Suggested probability for this stage: <b>{suggestedProb}%</b>
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

          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <input
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="e.g., 15000"
              inputMode="numeric"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted-foreground">Leave blank to default to 0.</div>
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

            <Link href="/dashboard/opportunities" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}