"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type TaskStatus = "New" | "In Progress" | "Done" | "Blocked";
type Option = { id: string; label: string };

const STATUSES: TaskStatus[] = ["New", "In Progress", "Done", "Blocked"];

function pickFirst(obj: any, keys: string[]) {
  for (const k of keys) if (k in obj) return k;
  return null;
}

export default function EditTaskForm({
  initial,
  opportunities,
  users,
}: {
  initial: any;
  opportunities: Option[];
  users: Option[];
}) {
  const router = useRouter();

  const titleKey = useMemo(() => pickFirst(initial, ["title", "name", "summary"]), [initial]);
  const detailsKey = useMemo(() => pickFirst(initial, ["details", "description", "notes"]), [initial]);
  const statusKey = useMemo(() => pickFirst(initial, ["status", "state"]), [initial]);
  const dueKey = useMemo(() => pickFirst(initial, ["due_at", "due_date", "scheduled_at"]), [initial]);

  const oppKey = useMemo(() => pickFirst(initial, ["opportunity_id", "project_id"]), [initial]);
  const assigneeKey = useMemo(() => pickFirst(initial, ["assigned_to", "assignee_id"]), [initial]);

  const id = initial.task_id || initial.id;

  const [title, setTitle] = useState(titleKey ? String(initial[titleKey] ?? "") : "");
  const [details, setDetails] = useState(detailsKey ? String(initial[detailsKey] ?? "") : "");

  const [status, setStatus] = useState<TaskStatus>(() => {
    const raw = statusKey ? String(initial[statusKey] ?? "") : "";
    if (STATUSES.includes(raw as TaskStatus)) return raw as TaskStatus;
    if (!raw) return "New";
    return "New";
  });

  const [opportunityId, setOpportunityId] = useState<string>(() => {
    if (!oppKey) return "";
    return initial[oppKey] ? String(initial[oppKey]) : "";
  });

  const [assignedTo, setAssignedTo] = useState<string>(() => {
    if (!assigneeKey) return "";
    return initial[assigneeKey] ? String(initial[assigneeKey]) : "";
  });

  const [dueRaw, setDueRaw] = useState(() => {
    if (!dueKey || !initial[dueKey]) return "";
    const d = new Date(initial[dueKey]);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!id) {
      setError("Task id missing on record.");
      return;
    }

    const update: any = {};
    if (titleKey) update[titleKey] = title.trim() || null;
    if (detailsKey) update[detailsKey] = details.trim() || null;
    if (statusKey) update[statusKey] = status;
    if (dueKey) update[dueKey] = dueRaw ? new Date(dueRaw).toISOString() : null;
    if (oppKey) update[oppKey] = opportunityId || null;
    if (assigneeKey) update[assigneeKey] = assignedTo || null;

    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setError(`Update returned non-JSON. First 120 chars: ${text.slice(0, 120)}`);
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to update task.");
        setSaving(false);
        return;
      }

      router.push("/dashboard/tasks");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error updating task.");
      setSaving(false);
    }
  }

  async function onDelete() {
    setError(null);

    if (!id) {
      setError("Task id missing on record.");
      return;
    }

    const ok = window.confirm("Delete this task? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setError(`Delete returned non-JSON. First 120 chars: ${text.slice(0, 120)}`);
        setDeleting(false);
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to delete task.");
        setDeleting(false);
        return;
      }

      router.push("/dashboard/tasks");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error deleting task.");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit Task"
        subtitle="Update task fields and follow-ups."
        right={
          <Link href="/dashboard/tasks" className="rounded-lg border px-3 py-2 text-sm">
            Back to Tasks
          </Link>
        }
      />

      <div className="max-w-3xl rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSave} className="space-y-4">
          {titleKey ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          {detailsKey ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {oppKey ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Project (Opportunity)</label>
                <select
                  value={opportunityId}
                  onChange={(e) => setOpportunityId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {assigneeKey ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Assigned To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {statusKey ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {dueKey ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">Due</label>
                <input
                  type="datetime-local"
                  value={dueRaw}
                  onChange={(e) => setDueRaw(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            ) : null}
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

            <Link href="/dashboard/tasks" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>

            <div className="flex-1" />

            <button
              type="button"
              onClick={onDelete}
              disabled={saving || deleting}
              className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
