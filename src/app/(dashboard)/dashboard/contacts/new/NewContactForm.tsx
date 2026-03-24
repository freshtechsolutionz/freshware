"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type Company = {
  id: string;
  name: string | null;
  website?: string | null;
  industry?: string | null;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  title: string;
  company_id: string;
};

export default function NewContactForm() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    title: "",
    company_id: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((j) => setCompanies(j.companies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Contact name is required.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          title: form.title.trim() || null,
          company_id: form.company_id || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to create contact.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard/contacts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating contact.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Contact"
        subtitle="Add a person and link them to a company profile."
        right={
          <Link href="/dashboard/contacts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Contacts
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Title / Role</label>
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Executive Director, Founder, COO"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
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
              disabled={loading}
            >
              <option value="">— No company linked —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Untitled Company"}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-muted-foreground">
              Link this contact to the actual company profile for better forecasting and relationship tracking.
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create contact"}
            </button>

            <Link href="/dashboard/contacts" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}