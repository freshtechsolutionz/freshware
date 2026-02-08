"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type Meeting = {
  id: string;
  external_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  scheduled_at: string | null;
  status: string | null;
  source: string | null;
  created_at: string | null;
  account_id: string | null;
};

type FormState = {
  contact_name: string;
  contact_email: string;
  scheduled_at_local: string; // datetime-local string
  status: string;
  source: string;
};

function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Convert to YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function EditMeetingForm({ initial }: { initial: Meeting }) {
  const router = useRouter();

  const initialLocal = useMemo(
    () => isoToLocalInput(initial.scheduled_at),
    [initial.scheduled_at]
  );

  const [form, setForm] = useState<FormState>({
    contact_name: initial.contact_name || "",
    contact_email: initial.contact_email || "",
    scheduled_at_local: initialLocal,
    status: initial.status || "scheduled",
    source: initial.source || "manual",
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.scheduled_at_local) return setError("Scheduled time is required.");

    const scheduledISO = new Date(form.scheduled_at_local).toISOString();

    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          scheduled_at: scheduledISO,
          status: form.status || null,
          source: form.source || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to update meeting.");
        setSaving(false);
        return;
      }

      router.push("/dashboard/meetings");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error updating meeting.");
      setSaving(false);
    }
  }

  async function onDelete() {
    setError(null);

    const ok = window.confirm("Delete this meeting? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${initial.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Failed to delete meeting.");
        setDeleting(false);
        return;
      }

      router.push("/dashboard/meetings");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error deleting meeting.");
      setDeleting(false);
    }
  }

  const isWebhookMeeting = initial.source === "youcanbookme";

  return (
    <div>
      <PageHeader
        title="Edit Meeting"
        subtitle="Update meeting details."
        right={
          <Link href="/dashboard/meetings" className="rounded-lg border px-3 py-2 text-sm">
            Back to Meetings
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        {isWebhookMeeting ? (
          <div className="mb-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            This meeting was created by YouCanBookMe. Editing it here only updates Freshware, not the
            booking in YouCanBookMe.
          </div>
        ) : null}

        <form onSubmit={onSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Contact name</label>
              <input
                value={form.contact_name}
                onChange={(e) => setField("contact_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Contact email</label>
              <input
                value={form.contact_email}
                onChange={(e) => setField("contact_email", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Scheduled at</label>
              <input
                type="datetime-local"
                value={form.scheduled_at_local}
                onChange={(e) => setField("scheduled_at_local", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="scheduled">scheduled</option>
                <option value="completed">completed</option>
                <option value="canceled">canceled</option>
                <option value="no_show">no_show</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Source</label>
            <input
              value={form.source}
              onChange={(e) => setField("source", e.target.value)}
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

            <Link href="/dashboard/meetings" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>

            <div className="flex-1" />

            <button
              type="button"
              onClick={onDelete}
              disabled={saving || deleting}
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
