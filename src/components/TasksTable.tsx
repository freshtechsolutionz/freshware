"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";
import { supabaseBrowser } from "@/lib/supabase/browser";

type TaskView = {
  task_id: string;
  opportunity_id: string | null;
  opportunity_name: string | null;
  title: string | null;
  description: string | null;
  due_at: string | null;
  status: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_role: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  account_id: string | null;
};

type Props = {
  role: string;
  tasks: TaskView[];
};

const supabase = supabaseBrowser();

function fmtDate(value: string | null) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  } catch {
    return value;
  }
}

function normalizeStatus(s: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "done") return "done";
  if (v === "in_progress") return "in_progress";
  return "todo";
}

function statusLabel(s: string | null) {
  const v = normalizeStatus(s);
  if (v === "done") return "Done";
  if (v === "in_progress") return "In progress";
  return "To do";
}

export default function TasksTable({ role, tasks }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "todo" | "in_progress" | "done">("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");

  const canCreate = ["CEO", "ADMIN", "SALES", "OPS"].includes((role || "").toUpperCase());

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks || []) {
      if (t.assigned_to) {
        const label = t.assignee_name
          ? `${t.assignee_name}${t.assignee_role ? ` (${t.assignee_role})` : ""}`
          : t.assigned_to;
        map.set(t.assigned_to, label);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [tasks]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (tasks || []).filter((t) => {
      const st = normalizeStatus(t.status);

      if (statusFilter && st !== statusFilter) return false;
      if (assigneeFilter && (t.assigned_to || "") !== assigneeFilter) return false;

      if (!q) return true;

      const title = (t.title || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const proj = (t.opportunity_name || t.opportunity_id || "").toLowerCase();
      const who = (t.assignee_name || t.assigned_to || "").toLowerCase();
      const id = (t.task_id || "").toLowerCase();

      return title.includes(q) || desc.includes(q) || proj.includes(q) || who.includes(q) || id.includes(q);
    });
  }, [tasks, search, statusFilter, assigneeFilter]);

  async function markDone(taskId: string) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("task_id", taskId);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.reload();
  }

  return (
    <div>
      <TableToolbar
        left={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, project, assignee..."
              className="min-w-[280px] rounded-lg border px-3 py-2 text-sm"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm bg-background"
            >
              <option value="">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm bg-background"
            >
              <option value="">All assignees</option>
              {assigneeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setAssigneeFilter("");
              }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              type="button"
            >
              Reset
            </button>

            {canCreate && (
              <Link
                href="/dashboard/tasks/new"
                className="rounded-lg border bg-background px-3 py-2 text-sm font-medium"
              >
                + New Task
              </Link>
            )}
          </>
        }
        right={
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{rows.length}</span> of{" "}
            <span className="font-medium">{tasks.length}</span>
          </div>
        }
      />

      <DataTableShell>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30">
              <Th>Task</Th>
              <Th>Project</Th>
              <Th>Assignee</Th>
              <Th>Due</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((t) => (
              <tr key={t.task_id} className="border-t">
                <Td>
                  <div className="font-semibold">{t.title || "(No title)"}</div>
                  {t.description ? (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {t.description}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-muted-foreground">{t.task_id}</div>
                </Td>

                <Td>
                  {t.opportunity_id ? (
                    <Link href={`/dashboard/opportunities/${t.opportunity_id}`} className="underline">
                      {t.opportunity_name || t.opportunity_id}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </Td>

                <Td>
                  {t.assigned_to ? (
                    <span>
                      {t.assignee_name || t.assigned_to}
                      {t.assignee_role ? <span className="text-muted-foreground"> ({t.assignee_role})</span> : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </Td>

                <Td>
                  {t.due_at ? (
                    <span>{fmtDate(t.due_at)}</span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </Td>

                <Td>
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                    {statusLabel(t.status)}
                  </span>
                </Td>

                <Td>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/dashboard/tasks/${t.task_id}`} className="underline">
                      View / Edit
                    </Link>

                    {normalizeStatus(t.status) !== "done" ? (
                      <button type="button" onClick={() => markDone(t.task_id)} className="underline">
                        Mark done
                      </button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <Td colSpan={6}>
                  <EmptyState
                    title="No tasks found"
                    description="Try clearing search/filters or create a new task."
                    actionHref={canCreate ? "/dashboard/tasks/new" : undefined}
                    actionLabel={canCreate ? "+ Create task" : undefined}
                  />
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
