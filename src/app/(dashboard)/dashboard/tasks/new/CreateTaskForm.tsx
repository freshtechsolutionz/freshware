"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TaskStatus = "New" | "In Progress" | "Done" | "Blocked";

type OpportunityLite = { id: string; label: string };
type UserLite = { id: string; label: string };

const STATUSES: TaskStatus[] = ["New", "In Progress", "Done", "Blocked"];

export default function CreateTaskForm(props: {
  opportunities?: OpportunityLite[];
  users?: UserLite[];
}) {
  const router = useRouter();

  const opportunities = props.opportunities ?? [];
  const users = props.users ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [opportunityId, setOpportunityId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  const [status, setStatus] = useState<TaskStatus>("New");
  const [dueRaw, setDueRaw] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        status, // enum label
        opportunity_id: opportunityId || null,
        assigned_to: assignedTo || null,
        due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setError(`Create task returned non-JSON. First 120 chars: ${text.slice(0, 120)}`);
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to create task.");
        setSaving(false);
        return;
      }

      router.push("/dashboard/tasks");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating task.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl rounded-2xl border bg-background p-6 shadow-sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Follow up with client"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Details for the task..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
            {opportunities.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No opportunities found for this account.
              </div>
            ) : null}
          </div>

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
            {users.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No users found for this account.
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="text-xs text-muted-foreground">
              Blocked means the task can’t move forward until something external happens (waiting on client, access, etc.).
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Due</label>
            <input
              type="datetime-local"
              value={dueRaw}
              onChange={(e) => setDueRaw(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create task"}
          </button>

          <button
            type="button"
            onClick={() => {
              router.push("/dashboard/tasks");
              router.refresh();
            }}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
