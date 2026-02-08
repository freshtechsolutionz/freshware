"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type FormState = {
  contact_name: string;
  contact_email: string;
  scheduled_at: string; // datetime-local input value
  status: string;
  source: string;
};

export default function NewMeetingForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    contact_name: "",
    contact_email: "",
    scheduled_at: "",
    status: "scheduled",
    source: "manual",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.scheduled_at) return setError("Scheduled time is required.");

    // Convert datetime-local to ISO
    const scheduledISO = new Date(form.scheduled_at).toISOString();

    setSubmitting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          scheduled_at: scheduledISO,
          status: form.status || "scheduled",
          source: form.source || "manual",
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to create meeting.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard/meetings");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating meeting.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Meeting"
        subtitle="Add a scheduled call, demo, or follow-up."
        right={
          <Link href="/dashboard/meetings" className="rounded-lg border px-3 py-2 text-sm">
            Back to Meetings
          </Link>
        }
      />

      <div className="max-w-2xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
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
                value={form.scheduled_at}
                onChange={(e) => setField("scheduled_at", e.target.value)}
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
            <div className="text-xs text-muted-foreground">
              Use "manual" for CRM entries. YCBM meetings will keep "youcanbookme".
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create meeting"}
            </button>

            <Link href="/dashboard/meetings" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
