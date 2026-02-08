"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type Account = {
  id: string;
  name: string | null;
  industry: string | null;
  created_at: string | null;
};

type FormState = {
  name: string;
  industry: string;
};

export default function EditAccountForm({ initial }: { initial: Account }) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: initial.name || "",
    industry: initial.industry || "",
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const industry = form.industry.trim();

    if (!name) return setError("Please enter an account name.");

    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to update account.");
        setSaving(false);
        return;
      }

      router.push("/dashboard/accounts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error updating account.");
      setSaving(false);
    }
  }

  async function onDelete() {
    setError(null);

    const ok = window.confirm(
      "Delete this account? This cannot be undone. If contacts or opportunities are linked to it, deletion may fail until those are updated."
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${initial.id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to delete account.");
        setDeleting(false);
        return;
      }

      router.push("/dashboard/accounts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error deleting account.");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit Account"
        subtitle="Update company information."
        right={
          <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Accounts
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Account name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Industry</label>
            <input
              value={form.industry}
              onChange={(e) => setField("industry", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

            <Link
              href="/dashboard/accounts"
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </Link>

            <div className="flex-1" />

            <button
              type="button"
              onClick={onDelete}
              disabled={saving || deleting}
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
