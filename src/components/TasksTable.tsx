"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";

type TaskStatus = "New" | "In Progress" | "Done" | "Blocked";

type TaskRow = {
  task_id: string;
  title: string | null;
  description: string | null;
  status: TaskStatus;
  due_at: string | null;
  opportunity_id: string | null;
  assigned_to: string | null;
  opportunity_name?: string | null;
  assignee_name?: string | null;
};

type Props = {
  role: string;
  viewerId: string;
  tasks: TaskRow[];
};

const STATUSES: TaskStatus[] = ["New", "In Progress", "Done", "Blocked"];

type Preset = {
  name: string;
  search: string;
  statuses: TaskStatus[];
  projectId: string;
  assigneeId: string;
  dueSoon: boolean;
  myTasks: boolean;
};

const STORAGE_KEY = "freshware.tasks.presets.v1";

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "...";
}

function isDueSoon(dueIso: string | null, days = 7) {
  if (!dueIso) return false;
  const d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

function fmtDue(dueIso: string | null) {
  if (!dueIso) return "None";
  const d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return "Invalid";
  return d.toLocaleDateString();
}

function statusChip(s: TaskStatus) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (s === "Done") return `${base} border-green-200 bg-green-50 text-green-700`;
  if (s === "Blocked") return `${base} border-red-200 bg-red-50 text-red-700`;
  if (s === "In Progress") return `${base} border-blue-200 bg-blue-50 text-blue-700`;
  return `${base} border-gray-200 bg-gray-50 text-gray-700`;
}

export default function TasksTable({ role, viewerId, tasks }: Props) {
  const roleUpper = (role || "").toUpperCase();
  const canCreate = ["CEO", "ADMIN", "SALES"].includes(roleUpper);
  const canUpdateStatus = ["CEO", "ADMIN", "SALES", "OPS", "STAFF"].includes(roleUpper);

  const [search, setSearch] = useState("");

  // Default view: New + In Progress
  const [statuses, setStatuses] = useState<TaskStatus[]>(["New", "In Progress"]);
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueSoon, setDueSoon] = useState(false);
  const [myTasks, setMyTasks] = useState(false);

  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [statusWorking, setStatusWorking] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Preset[]) : [];
      if (Array.isArray(parsed)) setPresets(parsed);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks || []) {
      if (!t.opportunity_id) continue;
      map.set(t.opportunity_id, t.opportunity_name || t.opportunity_id);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks || []) {
      if (!t.assigned_to) continue;
      map.set(t.assigned_to, t.assignee_name || t.assigned_to);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (tasks || []).filter((t) => {
      if (statuses.length && !statuses.includes(t.status)) return false;
      if (projectId && (t.opportunity_id || "") !== projectId) return false;

      const effectiveAssignee = myTasks ? viewerId : assigneeId;
      if (effectiveAssignee && (t.assigned_to || "") !== effectiveAssignee) return false;

      if (dueSoon) {
        if (t.status === "Done") return false;
        if (!isDueSoon(t.due_at, 7)) return false;
      }

      if (!q) return true;
      const hay = `${t.title ?? ""} ${t.description ?? ""} ${t.opportunity_name ?? ""} ${t.assignee_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, search, statuses, projectId, assigneeId, dueSoon, myTasks, viewerId]);

  function applyPreset(p: Preset) {
    setSearch(p.search);
    setStatuses(p.statuses);
    setProjectId(p.projectId);
    setAssigneeId(p.assigneeId);
    setDueSoon(p.dueSoon);
    setMyTasks(p.myTasks);
    setToast(`Loaded preset: ${p.name}`);
  }

  function resetToDefault() {
    setSearch("");
    setStatuses(["New", "In Progress"]);
    setProjectId("");
    setAssigneeId("");
    setDueSoon(false);
    setMyTasks(false);
  }

  function setQuickPreset(kind: "open" | "mine" | "due" | "all") {
    setSearch("");
    setProjectId("");
    setAssigneeId("");
    setPresetName("");

    if (kind === "open") {
      setStatuses(["New", "In Progress"]);
      setDueSoon(false);
      setMyTasks(false);
      return;
    }

    if (kind === "mine") {
      setStatuses(["New", "In Progress", "Blocked", "Done"]);
      setDueSoon(false);
      setMyTasks(true);
      return;
    }

    if (kind === "due") {
      setStatuses(["New", "In Progress", "Blocked"]);
      setDueSoon(true);
      setMyTasks(false);
      return;
    }

    setStatuses(["New", "In Progress", "Done", "Blocked"]);
    setDueSoon(false);
    setMyTasks(false);
  }

  function toggleStatus(s: TaskStatus) {
    setStatuses((prev) => {
      if (prev.includes(s)) return prev.filter((x) => x !== s);
      return [...prev, s];
    });
  }

  function saveCurrentPreset() {
    const name = presetName.trim();
    if (!name) {
      setToast("Enter a preset name");
      return;
    }

    const p: Preset = {
      name,
      search,
      statuses,
      projectId,
      assigneeId,
      dueSoon,
      myTasks,
    };

    setSavingPreset(true);
    try {
      const next = [...presets.filter((x) => x.name !== name), p].sort((a, b) => a.name.localeCompare(b.name));
      setPresets(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setPresetName("");
      setToast("Preset saved");
    } catch {
      setToast("Could not save preset");
    } finally {
      setSavingPreset(false);
    }
  }

  function deletePreset(name: string) {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setToast("Preset deleted");
  }

  async function updateTaskStatus(taskId: string, next: TaskStatus) {
    if (!canUpdateStatus) return;

    setStatusWorking(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setToast("Status update failed (non-JSON response)");
        setStatusWorking(null);
        return;
      }

      if (!res.ok) {
        setToast(json?.error || "Status update failed");
        setStatusWorking(null);
        return;
      }

      window.location.reload();
    } catch {
      setToast("Status update failed");
    } finally {
      setStatusWorking(null);
    }
  }

  return (
    <div>
      {toast ? (
        <div className="mb-3 rounded-lg border bg-background px-3 py-2 text-sm">{toast}</div>
      ) : null}

      {/* Quick filters – scrollable on mobile */}
      <div className="mb-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        <button onClick={() => setQuickPreset("open")} className="shrink-0 rounded-lg border px-3 py-2 text-sm">
          Open
        </button>
        <button onClick={() => setQuickPreset("mine")} className="shrink-0 rounded-lg border px-3 py-2 text-sm">
          My Tasks
        </button>
        <button onClick={() => setQuickPreset("due")} className="shrink-0 rounded-lg border px-3 py-2 text-sm">
          Due Soon
        </button>
        <button onClick={() => setQuickPreset("all")} className="shrink-0 rounded-lg border px-3 py-2 text-sm">
          All
        </button>

        <div className="w-px self-stretch bg-border mx-1" />

        <select
          defaultValue=""
          onChange={(e) => {
            const name = e.target.value;
            if (!name) return;
            const p = presets.find((x) => x.name === name);
            if (p) applyPreset(p);
            e.currentTarget.value = "";
          }}
          className="shrink-0 rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Load preset...</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <TableToolbar
        left={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full sm:w-auto sm:min-w-[220px] rounded-lg border px-3 py-2 text-sm"
            />

            <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
              <span className="text-xs font-semibold">Status</span>
              {STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggleStatus(s)} />
                  <span>{s}</span>
                </label>
              ))}
            </div>

            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full sm:w-auto rounded-lg border px-3 py-2 text-sm sm:max-w-[240px]"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={myTasks}
              className="w-full sm:w-auto rounded-lg border px-3 py-2 text-sm sm:max-w-[220px] disabled:opacity-60"
            >
              <option value="">All assignees</option>
              {assigneeOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <input type="checkbox" checked={dueSoon} onChange={(e) => setDueSoon(e.target.checked)} />
              Due soon (7d)
            </label>

            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <input type="checkbox" checked={myTasks} onChange={(e) => setMyTasks(e.target.checked)} />
              My tasks
            </label>

            <button onClick={resetToDefault} className="rounded-lg border bg-background px-3 py-2 text-sm" type="button">
              Reset
            </button>

            {canCreate ? (
              <Link href="/dashboard/tasks/new" className="rounded-lg border bg-background px-3 py-2 text-sm font-medium">
                + New Task
              </Link>
            ) : null}
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="min-w-[160px] rounded-lg border px-3 py-2 text-sm"
            />
            <button onClick={saveCurrentPreset} disabled={savingPreset} className="rounded-lg border px-3 py-2 text-sm" type="button">
              Save preset
            </button>

            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{rows.length}</span> of{" "}
              <span className="font-medium">{tasks.length}</span>
            </div>
          </div>
        }
      />

      {presets.length ? (
        <div className="mt-2 mb-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => deletePreset(p.name)}
              className="rounded-lg border px-2 py-1 text-xs"
              type="button"
              title="Delete preset"
            >
              Delete: {p.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* MOBILE VIEW: cards */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border bg-background p-4">
            <EmptyState
              title="No tasks found"
              description="Try changing filters or create a new task."
              actionHref={canCreate ? "/dashboard/tasks/new" : undefined}
              actionLabel={canCreate ? "+ Create task" : undefined}
            />
          </div>
        ) : (
          rows.map((t) => (
            <div key={t.task_id} className="rounded-2xl border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-gray-900 break-words">
                    {t.title || "(No title)"}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={statusChip(t.status)}>{t.status}</span>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white">
                      Due: {fmtDue(t.due_at)}
                    </span>
                  </div>
                </div>

                <Link href={`/dashboard/tasks/${t.task_id}`} className="fw-chip shrink-0">
                  Open
                </Link>
              </div>

              <div className="mt-3 text-sm text-gray-700">
                <div className="text-xs font-semibold text-gray-700">Project</div>
                <div className="mt-1">
                  {t.opportunity_id ? (
                    <Link href={`/dashboard/opportunities/${t.opportunity_id}`} className="underline font-medium break-words">
                      {t.opportunity_name || "View project"}
                    </Link>
                  ) : (
                    <span className="text-gray-500">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-700">
                <div className="text-xs font-semibold text-gray-700">Assignee</div>
                <div className="mt-1">
                  {t.assignee_name ? <span className="font-medium">{t.assignee_name}</span> : <span className="text-gray-500">Unassigned</span>}
                </div>
              </div>

              {t.description ? (
                <div className="mt-3 text-sm text-gray-700">
                  <div className="text-xs font-semibold text-gray-700">Notes</div>
                  <div className="mt-1 break-words">{truncate(t.description, 220)}</div>
                </div>
              ) : null}

              {canUpdateStatus ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-700">Update status</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={statusWorking === t.task_id || s === t.status}
                        onClick={() => updateTaskStatus(t.task_id, s)}
                        className="h-11 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50"
                      >
                        {statusWorking === t.task_id && s !== t.status ? "Working..." : s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* DESKTOP VIEW: table */}
      <div className="hidden md:block">
        <DataTableShell>
          <table className="w-full border-collapse text-sm table-fixed">
            <colgroup>
              <col style={{ width: "34%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>

            <thead>
              <tr className="bg-muted/30">
                <Th>Task</Th>
                <Th>Project</Th>
                <Th>Assignee</Th>
                <Th>Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((t) => (
                <tr key={t.task_id} className="border-t align-top">
                  <Td>
                    <div className="min-w-0 overflow-hidden">
                      <div className="font-semibold break-words">{t.title || "(No title)"}</div>

                      {t.description ? (
                        <div
                          className="mt-1 text-xs text-muted-foreground break-words overflow-hidden"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                          }}
                          title={t.description}
                        >
                          {truncate(t.description, 500)}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted-foreground">No description</div>
                      )}

                      <div className="mt-2 text-[11px] text-muted-foreground font-mono overflow-hidden text-ellipsis">
                        {t.task_id}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <Link href={`/dashboard/tasks/${t.task_id}`} className="underline">
                          View / Edit
                        </Link>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <div className="min-w-0 overflow-hidden">
                      {t.opportunity_id ? (
                        <Link href={`/dashboard/opportunities/${t.opportunity_id}`} className="underline font-medium break-words">
                          {t.opportunity_name || "View project"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  </Td>

                  <Td>
                    <div className="min-w-0 overflow-hidden break-words">
                      {t.assignee_name ? <span className="font-medium">{t.assignee_name}</span> : <span className="text-muted-foreground">Unassigned</span>}
                    </div>
                  </Td>

                  <Td>{t.due_at ? <div className="text-sm">{new Date(t.due_at).toLocaleDateString()}</div> : <span className="text-muted-foreground">None</span>}</Td>

                  <Td>
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm font-semibold">{t.status}</div>

                      {canUpdateStatus ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={statusWorking === t.task_id || s === t.status}
                              onClick={() => updateTaskStatus(t.task_id, s)}
                              className="rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {statusWorking === t.task_id && s !== t.status ? "Working..." : s}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <Td colSpan={5}>
                    <EmptyState
                      title="No tasks found"
                      description="Try changing filters or create a new task."
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

      {/* Mobile sticky create button */}
      {canCreate ? (
        <Link
          href="/dashboard/tasks/new"
          className="md:hidden fixed bottom-5 right-5 z-50 rounded-full bg-black text-white px-5 py-3 text-sm font-semibold shadow-lg"
        >
          + Task
        </Link>
      ) : null}
    </div>
  );
}
