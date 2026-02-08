"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  account_id: string | null;
  created_at: string | null;
};

type AccountLite = { id: string; name: string | null };

type FormState = {
  name: string;
  email: string;
  phone: string;
  account_id: string;
};

export default function EditContactForm({
  initial,
  accounts,
}: {
  initial: Contact;
  accounts: AccountLite[];
}) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: initial.name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    account_id: initial.account_id || "",
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
    if (!name) return setError("Contact name is required.");

    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          account_id: form.account_id || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to update contact.");
        setSaving(false);
        return;
      }

      router.push("/dashboard/contacts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error updating contact.");
      setSaving(false);
    }
  }

  async function onDelete() {
    setError(null);

    const ok = window.confirm("Delete this contact? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${initial.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Failed to delete contact.");
        setDeleting(false);
        return;
      }

      router.push("/dashboard/contacts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error deleting contact.");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit Contact"
        subtitle="Update contact details."
        right={
          <Link href="/dashboard/contacts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Contacts
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <input
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Account</label>
            <select
              value={form.account_id}
              onChange={(e) => setField("account_id", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">— No account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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

            <Link href="/dashboard/contacts" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>

            <div className="flex-1" />

            <button
              type="button"
              onClick={onDelete}
              disabled={saving || deleting}
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
