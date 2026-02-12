"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TaskStatus = "New" | "In Progress" | "Done" | "Blocked";

type ProjectRow = {
  id: string;
  opportunity_id: string | null;
  name: string | null;
  status: string | null;
  stage: string | null;
  start_date: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  health: string | null;
  account_id: string | null;
  description: string | null;
  internal_notes: string | null;
};

type TaskRow = {
  task_id: string;
  title: string | null;
  description: string | null;
  status: TaskStatus | string;
  due_at: string | null;
  assigned_to: string | null;
  assignee_name?: string | null;
};

type UpdateRow = {
  id: string;
  project_id: string;
  account_id: string;
  created_by: string | null;
  created_at: string;
  title: string;
  body: string | null;
  client_visible: boolean;
  author_name?: string | null;
};

const STAGES = ["Intake", "Planning", "Design", "Development", "QA", "Launch", "Support"] as const;
const TASK_STATUSES: TaskStatus[] = ["New", "In Progress", "Done", "Blocked"];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleString();
  } catch {
    return d;
  }
}

function clampText(s: string | null | undefined, n: number) {
  const v = (s || "").trim();
  if (!v) return "";
  if (v.length <= n) return v;
  return v.slice(0, n).trim() + "…";
}

export default function ProjectClient(props: {
  viewerRole: string;
  viewerAccountId: string;
  isStaff: boolean;

  project: ProjectRow;
  opportunityName: string | null;

  initialTasks: TaskRow[];
  initialUpdates: UpdateRow[];
}) {
  const router = useRouter();

  const [tab, setTab] = useState<"overview" | "updates" | "tasks">("overview");

  const [project, setProject] = useState<ProjectRow>(props.project);
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [updates, setUpdates] = useState<UpdateRow[]>(props.initialUpdates || []);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskRow[]>(props.initialTasks || []);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Update form
  const [uTitle, setUTitle] = useState("");
  const [uBody, setUBody] = useState("");
  const [uClientVisible, setUClientVisible] = useState(true);

  // Quick task add (simple and fast)
  const [tTitle, setTTitle] = useState("");
  const [tStatus, setTStatus] = useState<TaskStatus>("New");
  const [tDueRaw, setTDueRaw] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const stageIndex = useMemo(() => {
    const idx = STAGES.findIndex((s) => s === (project.stage as any));
    return idx >= 0 ? idx : 0;
  }, [project.stage]);

  async function saveProjectPatch(patch: Partial<ProjectRow>) {
    setProjectError(null);
    setSavingProject(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProjectError(json?.error || "Failed to update project.");
        setSavingProject(false);
        return;
      }
      setProject((prev) => ({ ...prev, ...(json.project || patch) }));
      router.refresh();
      setSavingProject(false);
    } catch (e: any) {
      setProjectError(e?.message || "Failed to update project.");
      setSavingProject(false);
    }
  }

  async function reloadUpdates() {
    setUpdateError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/updates`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUpdateError(json?.error || "Failed to load updates.");
        return;
      }
      setUpdates((json.updates || []) as UpdateRow[]);
    } catch (e: any) {
      setUpdateError(e?.message || "Failed to load updates.");
    }
  }

  async function postUpdate() {
    setUpdateError(null);

    const title = uTitle.trim();
    if (!title) {
      setUpdateError("Update title is required.");
      return;
    }

    setPostingUpdate(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body: uBody.trim() || null,
          client_visible: props.isStaff ? !!uClientVisible : true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUpdateError(json?.error || "Failed to post update.");
        setPostingUpdate(false);
        return;
      }

      setUTitle("");
      setUBody("");
      setUClientVisible(true);
      await reloadUpdates();
      setPostingUpdate(false);
    } catch (e: any) {
      setUpdateError(e?.message || "Failed to post update.");
      setPostingUpdate(false);
    }
  }

  async function reloadTasks() {
    setTaskError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskError(json?.error || "Failed to load tasks.");
        return;
      }
      setTasks((json.tasks || []) as TaskRow[]);
    } catch (e: any) {
      setTaskError(e?.message || "Failed to load tasks.");
    }
  }

  async function quickCreateTask() {
    setTaskError(null);
    const title = tTitle.trim();
    if (!title) {
      setTaskError("Task title is required.");
      return;
    }

    setCreatingTask(true);
    try {
      const due_at = tDueRaw ? new Date(tDueRaw).toISOString() : null;

      const res = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: tStatus,
          due_at,
          project_id: project.id,
          opportunity_id: project.opportunity_id,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskError(json?.error || "Failed to create task.");
        setCreatingTask(false);
        return;
      }

      setTTitle("");
      setTStatus("New");
      setTDueRaw("");
      await reloadTasks();
      setCreatingTask(false);
    } catch (e: any) {
      setTaskError(e?.message || "Failed to create task.");
      setCreatingTask(false);
    }
  }

  async function setTaskStatus(taskId: string, next: TaskStatus) {
    setTaskError(null);
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTaskError(json?.error || "Failed to update task status.");
        setUpdatingTaskId(null);
        return;
      }
      await reloadTasks();
      setUpdatingTaskId(null);
    } catch (e: any) {
      setTaskError(e?.message || "Failed to update task status.");
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top summary */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">Project</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {project.name || "Untitled Project"}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Pill label="Stage" value={project.stage || "Intake"} />
              <Pill label="Status" value={project.status || "Active"} />
              <Pill label="Health" value={project.health || "Good"} />
              <Pill label="Due Date" value={project.due_date || "—"} mono />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {project.opportunity_id ? (
                <Link
                  href={`/dashboard/opportunities/${project.opportunity_id}`}
                  className="rounded-2xl border px-3 py-2 font-semibold hover:bg-gray-50"
                >
                  Opportunity: {props.opportunityName || "View"}
                </Link>
              ) : (
                <span className="rounded-2xl border bg-gray-50 px-3 py-2 font-semibold text-gray-700">
                  No linked opportunity
                </span>
              )}

              <Link
                href="/dashboard/tasks"
                className="rounded-2xl border px-3 py-2 font-semibold hover:bg-gray-50"
              >
                All Tasks
              </Link>
            </div>
          </div>

          {/* Staff-only controls */}
          <div className="w-full lg:w-[360px] rounded-3xl border bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Project Controls</div>
            <div className="mt-1 text-xs text-gray-600">
              {props.isStaff ? "Internal controls (team)" : "Read-only (client view)"}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-700">Stage</div>
                <select
                  value={project.stage || "Intake"}
                  onChange={(e) => {
                    const next = e.target.value;
                    setProject((p) => ({ ...p, stage: next }));
                    if (props.isStaff) saveProjectPatch({ stage: next });
                  }}
                  disabled={!props.isStaff || savingProject}
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ControlInput
                  label="Status"
                  value={project.status || ""}
                  disabled={!props.isStaff || savingProject}
                  onChange={(v) => {
                    setProject((p) => ({ ...p, status: v }));
                  }}
                  onBlur={() => props.isStaff && saveProjectPatch({ status: project.status })}
                />
                <ControlInput
                  label="Health"
                  value={project.health || ""}
                  disabled={!props.isStaff || savingProject}
                  onChange={(v) => {
                    setProject((p) => ({ ...p, health: v }));
                  }}
                  onBlur={() => props.isStaff && saveProjectPatch({ health: project.health })}
                />
              </div>

              {projectError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {projectError}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stage tracker */}
        <div className="mt-6 rounded-3xl border bg-white p-5">
          <div className="text-sm font-semibold text-gray-900">Stage Tracker</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {STAGES.map((s, i) => {
              const active = i === stageIndex;
              const done = i < stageIndex;
              const cls = done
                ? "bg-green-50 border-green-200 text-green-800"
                : active
                ? "bg-black text-white border-black"
                : "bg-gray-50 border-gray-200 text-gray-700";
              return (
                <div key={s} className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${cls}`}>
                  {s}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="rounded-3xl border bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2 p-3">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Overview" />
          <TabButton active={tab === "updates"} onClick={() => setTab("updates")} label="Updates" />
          <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} label="Tasks" />
        </div>
      </section>

      {/* Overview */}
      {tab === "overview" ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Project Description</div>
            <div className="mt-1 text-xs text-gray-600">
              {props.isStaff ? "Team-managed description." : "Client-facing project summary."}
            </div>

            <textarea
              value={project.description || ""}
              onChange={(e) => setProject((p) => ({ ...p, description: e.target.value }))}
              onBlur={() => props.isStaff && saveProjectPatch({ description: project.description })}
              disabled={!props.isStaff}
              className="mt-4 min-h-[160px] w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
              placeholder={props.isStaff ? "Write a clear project summary..." : ""}
            />
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Project Notes</div>
            <div className="mt-1 text-xs text-gray-600">
              Internal notes are visible to Fresh Tech only.
            </div>

            <textarea
              value={project.internal_notes || ""}
              onChange={(e) => setProject((p) => ({ ...p, internal_notes: e.target.value }))}
              onBlur={() => props.isStaff && saveProjectPatch({ internal_notes: project.internal_notes })}
              disabled={!props.isStaff}
              className="mt-4 min-h-[160px] w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
              placeholder={props.isStaff ? "Add internal notes, risks, decisions, blockers..." : ""}
            />

            {!props.isStaff ? (
              <div className="mt-3 rounded-2xl border bg-gray-50 p-3 text-xs text-gray-700">
                Internal notes are hidden in client mode.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Updates */}
      {tab === "updates" ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border bg-white p-6 shadow-sm lg:col-span-1">
            <div className="text-sm font-semibold text-gray-900">Post an update</div>
            <div className="mt-1 text-xs text-gray-600">
              {props.isStaff
                ? "Choose whether the client can see it."
                : "Client messages are visible to the team."}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-700">Title</div>
                <input
                  value={uTitle}
                  onChange={(e) => setUTitle(e.target.value)}
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Example: Design approved"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700">Details</div>
                <textarea
                  value={uBody}
                  onChange={(e) => setUBody(e.target.value)}
                  className="mt-1 min-h-[120px] w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Write what changed, what’s next, and timeline expectations."
                />
              </div>

              {props.isStaff ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={uClientVisible}
                    onChange={(e) => setUClientVisible(e.target.checked)}
                  />
                  Client-visible
                </label>
              ) : null}

              {updateError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {updateError}
                </div>
              ) : null}

              <button
                onClick={postUpdate}
                disabled={postingUpdate}
                className="w-full rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {postingUpdate ? "Posting..." : "Post update"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Timeline</div>
                <div className="mt-1 text-xs text-gray-600">
                  {props.isStaff ? "Showing all updates." : "Showing client-visible updates only."}
                </div>
              </div>
              <button
                onClick={reloadUpdates}
                className="rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                type="button"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {updates.length === 0 ? (
                <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                  No updates yet.
                </div>
              ) : (
                updates.map((u) => (
                  <div key={u.id} className="rounded-3xl border p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900">{u.title}</div>
                      <div className="text-xs text-gray-500">{fmtDate(u.created_at)}</div>
                    </div>

                    <div className="mt-1 text-xs text-gray-600">
                      By {u.author_name || "Unknown"}
                      {props.isStaff ? (
                        <>
                          {" "}
                          <span className="text-gray-300">•</span>{" "}
                          <span className="font-semibold">
                            {u.client_visible ? "Client-visible" : "Internal-only"}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {u.body ? (
                      <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">
                        {u.body}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Tasks */}
      {tab === "tasks" ? (
        <section className="space-y-4">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Project Tasks</div>
                <div className="mt-1 text-xs text-gray-600">
                  Quick-create tasks scoped to this project. Full editing happens in Tasks.
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div>
                  <div className="text-xs font-semibold text-gray-700">Title</div>
                  <input
                    value={tTitle}
                    onChange={(e) => setTTitle(e.target.value)}
                    className="mt-1 w-full sm:w-[260px] rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="Example: Send first UI draft"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700">Status</div>
                  <select
                    value={tStatus}
                    onChange={(e) => setTStatus(e.target.value as TaskStatus)}
                    className="mt-1 w-full sm:w-[180px] rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700">Due</div>
                  <input
                    type="datetime-local"
                    value={tDueRaw}
                    onChange={(e) => setTDueRaw(e.target.value)}
                    className="mt-1 w-full sm:w-[220px] rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>

                <button
                  onClick={quickCreateTask}
                  disabled={creatingTask}
                  className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  type="button"
                >
                  {creatingTask ? "Creating..." : "Add task"}
                </button>
              </div>
            </div>

            {taskError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {taskError}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Task List</div>
                <div className="mt-1 text-xs text-gray-600">
                  Description is truncated to protect layout.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reloadTasks}
                  className="rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                  type="button"
                >
                  Refresh
                </button>
                <Link
                  href="/dashboard/tasks"
                  className="rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  Open Tasks
                </Link>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <Th>Task</Th>
                    <Th>Status</Th>
                    <Th>Due</Th>
                    <Th>Assignee</Th>
                    <Th>Quick status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>

                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <Td colSpan={6}>
                        <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                          No tasks for this project yet.
                        </div>
                      </Td>
                    </tr>
                  ) : (
                    tasks.map((t) => (
                      <tr key={t.task_id} className="border-t">
                        <Td>
                          <div className="font-semibold text-gray-900">{t.title || "(No title)"}</div>
                          {t.description ? (
                            <div className="mt-1 text-xs text-gray-600">
                              {clampText(t.description, 120)}
                            </div>
                          ) : null}
                          <div className="mt-1 text-[11px] text-gray-400">{t.task_id}</div>
                        </Td>

                        <Td>
                          <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                            {t.status || "New"}
                          </span>
                        </Td>

                        <Td>{t.due_at ? fmtDate(t.due_at) : "—"}</Td>

                        <Td>{t.assignee_name || "Unassigned"}</Td>

                        <Td>
                          {/* 2x2 layout for better alignment */}
                          <div className="grid grid-cols-2 gap-2">
                            {TASK_STATUSES.map((s) => (
                              <button
                                key={s}
                                disabled={updatingTaskId === t.task_id}
                                onClick={() => setTaskStatus(t.task_id, s)}
                                className="rounded-xl border px-2 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                                type="button"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </Td>

                        <Td>
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/dashboard/tasks/${t.task_id}`}
                              className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                            >
                              View/Edit
                            </Link>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {props.isStaff ? (
              <div className="mt-4 rounded-2xl border bg-gray-50 p-3 text-xs text-gray-700">
                Blocked means the task cannot progress until a dependency is resolved (client approval, missing asset, third-party delay, etc.).
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      className={
        props.active
          ? "rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white"
          : "rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
      }
      type="button"
    >
      {props.label}
    </button>
  );
}

function Pill(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border bg-gray-50 px-4 py-3">
      <div className="text-xs font-semibold text-gray-700">{props.label}</div>
      <div className={`mt-1 text-sm font-semibold text-gray-900 ${props.mono ? "font-mono" : ""}`}>
        {props.value}
      </div>
    </div>
  );
}

function ControlInput(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700">{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
        disabled={props.disabled}
        className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
      />
    </div>
  );
}

function Th(props: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{props.children}</th>;
}

function Td(props: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td className="px-4 py-3 align-top" colSpan={props.colSpan}>
      {props.children}
    </td>
  );
}
