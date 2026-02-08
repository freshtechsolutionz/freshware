"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type FormState = {
  name: string;
  industry: string;
};

export default function NewAccountForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ name: "", industry: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const industry = form.industry.trim();

    if (!name) return setError("Please enter an account name.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Failed to create account.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard/accounts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating account.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Account"
        subtitle="Add a company or organization to your CRM."
        right={
          <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Accounts
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Account name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g., Greater Heights Chamber of Commerce"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Industry</label>
            <input
              value={form.industry}
              onChange={(e) => setField("industry", e.target.value)}
              placeholder="e.g., Nonprofit / Chamber / Healthcare"
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
              {submitting ? "Creating..." : "Create account"}
            </button>

            <Link href="/dashboard/accounts" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
