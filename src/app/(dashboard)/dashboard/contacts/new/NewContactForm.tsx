"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type Account = {
  id: string;
  name: string | null;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  account_id: string;
};

export default function NewContactForm() {
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    account_id: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts || []))
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
          account_id: form.account_id || null,
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
        subtitle="Add a person associated with an account."
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
            <label className="text-sm font-medium">Account</label>
            <select
              value={form.account_id}
              onChange={(e) => setField("account_id", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="">— No account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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
