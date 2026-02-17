"use client";

import { useMemo, useState } from "react";

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

type AssigneeOption = { id: string; label: string };

type FinancialsRow =
  | {
      id: string;
      project_id: string;
      account_id: string;
      budget_total: number | null;
      cost_to_date: number | null;
      billed_to_date: number | null;
      paid_to_date: number | null;
      currency: string;
      updated_at: string;
      created_at: string;
    }
  | null;

type TeamMemberRow = {
  id: string;
  project_id: string;
  account_id: string;
  member_user_id: string;
  role: string | null;
  created_at: string;
  member_name?: string | null;
};

type MilestoneRow = {
  id: string;
  project_id: string;
  account_id: string;
  title: string;
  // NOTE: Some DBs may not have this column yet. We keep it optional and
  // we DO NOT send it unless user enters a value.
  description?: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
};

const TASK_STATUSES: TaskStatus[] = ["New", "In Progress", "Done", "Blocked"];

function fmtDate(s: string | null | undefined) {
  if (!s) return "N/A";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function currency(n: number | null | undefined, code?: string) {
  if (n === null || n === undefined) return "N/A";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}

async function jsonFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

function percent(n: number) {
  return `${clamp(Math.round(n), 0, 100)}%`;
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deriveBurn(fin: FinancialsRow) {
  const budget = fin?.budget_total ?? null;
  const cost = fin?.cost_to_date ?? null;
  if (budget === null || budget <= 0 || cost === null) return null;
  return clamp((cost / budget) * 100, 0, 999);
}

function deriveCollection(fin: FinancialsRow) {
  const billed = fin?.billed_to_date ?? null;
  const paid = fin?.paid_to_date ?? null;
  if (billed === null || billed <= 0 || paid === null) return null;
  return clamp((paid / billed) * 100, 0, 999);
}

export default function ProjectClient(props: {
  viewerRole: string;
  viewerAccountId: string;
  isStaff: boolean;
  project: ProjectRow;
  opportunityName: string | null;
  initialTasks: TaskRow[];
  initialUpdates: UpdateRow[];
  assignees: AssigneeOption[];
  initialFinancials: FinancialsRow;
  initialTeam: TeamMemberRow[];
  initialMilestones: MilestoneRow[];
}) {
  const { project, isStaff, opportunityName, assignees } = props;

  const [tab, setTab] = useState<
    "Overview" | "Tasks" | "Updates" | "Financials" | "Team" | "Milestones"
  >("Overview");

  const [tasks, setTasks] = useState<TaskRow[]>(props.initialTasks || []);
  const [updates, setUpdates] = useState<UpdateRow[]>(props.initialUpdates || []);
  const [financials, setFinancials] = useState<FinancialsRow>(
    props.initialFinancials || null
  );
  const [team, setTeam] = useState<TeamMemberRow[]>(props.initialTeam || []);
  const [milestones, setMilestones] = useState<MilestoneRow[]>(
    props.initialMilestones || []
  );

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const projectStart = project.start_date ? new Date(project.start_date) : null;
  const projectDue = project.due_date ? new Date(project.due_date) : null;
  const today = new Date();

  const timeline = useMemo(() => {
    if (
      !projectStart ||
      !projectDue ||
      isNaN(projectStart.getTime()) ||
      isNaN(projectDue.getTime())
    ) {
      return {
        has: false,
        pct: 0,
        daysLeft: null as number | null,
        total: null as number | null,
      };
    }
    const total = Math.max(1, daysBetween(projectStart, projectDue));
    const elapsed = clamp(daysBetween(projectStart, today), 0, total);
    const pct = clamp(Math.round((elapsed / total) * 100), 0, 100);
    const daysLeft = daysBetween(today, projectDue);
    return { has: true, pct, daysLeft, total };
  }, [project.start_date, project.due_date]);

  const taskCounts = useMemo(() => {
    const c: Record<string, number> = {
      New: 0,
      "In Progress": 0,
      Done: 0,
      Blocked: 0,
    };
    for (const t of tasks) {
      const s = TASK_STATUSES.includes(t.status as any)
        ? (t.status as TaskStatus)
        : "New";
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [tasks]);

  const onTrackSignal = useMemo(() => {
    if (!timeline.has) {
      return {
        label: "Unknown",
        detail: "Add start and due dates to unlock timeline insights.",
        score: 50,
      };
    }

    const daysLeft = timeline.daysLeft ?? 0;
    const blocked = taskCounts["Blocked"] || 0;
    const inprog = taskCounts["In Progress"] || 0;
    const done = taskCounts["Done"] || 0;
    const total = tasks.length || 1;

    const donePct = Math.round((done / total) * 100);

    const risk =
      (daysLeft < 0 ? 3 : daysLeft <= 7 ? 2 : 0) +
      (blocked > 0 ? 2 : 0) +
      (inprog > 6 ? 1 : 0);

    if (risk >= 4) {
      return {
        label: "At Risk",
        detail: `Days left: ${daysLeft}. Blocked: ${blocked}. Done: ${donePct}%.`,
        score: 25,
      };
    }
    if (risk >= 2) {
      return {
        label: "Watch",
        detail: `Days left: ${daysLeft}. Blocked: ${blocked}. Done: ${donePct}%.`,
        score: 60,
      };
    }
    return {
      label: "On Track",
      detail: `Days left: ${daysLeft}. Blocked: ${blocked}. Done: ${donePct}%.`,
      score: 85,
    };
  }, [timeline, taskCounts, tasks.length]);

  const kanban = useMemo(() => {
    const cols: Record<TaskStatus, TaskRow[]> = {
      New: [],
      "In Progress": [],
      Done: [],
      Blocked: [],
    };
    for (const t of tasks) {
      const s = TASK_STATUSES.includes(t.status as any)
        ? (t.status as TaskStatus)
        : "New";
      cols[s].push(t);
    }
    for (const k of TASK_STATUSES) {
      cols[k].sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
    }
    return cols;
  }, [tasks]);

  const burnPct = useMemo(() => deriveBurn(financials), [financials]);
  const collectPct = useMemo(() => deriveCollection(financials), [financials]);

  const teamCount = team.length;
  const milestoneDonePct = useMemo(() => {
    if (!milestones.length) return 0;
    const done = milestones.filter(
      (m) => String(m.status || "").toLowerCase() === "done"
    ).length;
    return Math.round((done / milestones.length) * 100);
  }, [milestones]);

  const priorityMilestones = useMemo(() => {
    const list = [...milestones];
    list.sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
    return list.slice(0, 6);
  }, [milestones]);

  async function refreshAll() {
    setErr(null);
    setBusy(true);
    try {
      const pid = project.id;

      const [t, u, f, tm, ms] = await Promise.all([
        jsonFetch(`/api/tasks?project_id=${encodeURIComponent(pid)}`),
        jsonFetch(`/api/projects/${pid}/updates`),
        jsonFetch(`/api/projects/${pid}/financials`),
        jsonFetch(`/api/projects/${pid}/team`),
        jsonFetch(`/api/projects/${pid}/milestones`),
      ]);

      setTasks(t?.tasks || []);
      setUpdates(u?.updates || []);
      setFinancials(f?.financials || null);
      setTeam(tm?.team || []);
      setMilestones(ms?.milestones || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to refresh.");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(payload: {
    title: string;
    description?: string | null;
    due_at?: string | null;
    assigned_to?: string | null;
  }) {
    setErr(null);
    setBusy(true);
    try {
      const res = await jsonFetch(`/api/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description ?? null,
          due_at: payload.due_at ?? null,
          assigned_to: payload.assigned_to ?? null,
          project_id: project.id,
          status: "New",
        }),
      });
      const created = res?.task;
      if (created) {
        const assignee_name = created.assigned_to
          ? assignees.find((a) => a.id === created.assigned_to)?.label || null
          : null;

        setTasks((prev) => [{ ...created, assignee_name }, ...prev]);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to create task.");
    } finally {
      setBusy(false);
    }
  }

  async function patchTask(taskId: string, patch: any) {
    setErr(null);
    setBusy(true);
    try {
      const res = await jsonFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const updated = res?.task;
      if (updated) {
        const assignee_name = updated.assigned_to
          ? assignees.find((a) => a.id === updated.assigned_to)?.label || null
          : null;

        setTasks((prev) =>
          prev.map((t) =>
            t.task_id === taskId ? { ...updated, assignee_name } : t
          )
        );
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to update task.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(taskId: string) {
    setErr(null);
    setBusy(true);
    try {
      await jsonFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (e: any) {
      setErr(e?.message || "Failed to delete task.");
    } finally {
      setBusy(false);
    }
  }

  async function createUpdate(payload: {
    title?: string | null;
    body?: string | null;
    client_visible?: boolean;
    visibility?: string;
  }) {
    setErr(null);
    setBusy(true);
    try {
      const res = await jsonFetch(`/api/projects/${project.id}/updates`, {
        method: "POST",
        body: JSON.stringify({
          title: payload.title ?? null,
          body: payload.body ?? null,
          message: payload.body ?? null, // API accepts message OR body; sending both is safe
          client_visible: Boolean(payload.client_visible),
          visibility: payload.visibility || (payload.client_visible ? "client" : "internal"),
        }),
      });

      const created = res?.update;
      if (created) {
        setUpdates((prev) => [created, ...prev]);
      } else {
        // fallback: refresh
        await refreshAll();
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to create update.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFinancials(patch: any) {
    setErr(null);
    setBusy(true);
    try {
      // normalize numbers if user typed text
      const normalized = {
        ...patch,
        budget_total: patch.budget_total === "" ? null : safeNum(patch.budget_total),
        cost_to_date: patch.cost_to_date === "" ? null : safeNum(patch.cost_to_date),
        billed_to_date: patch.billed_to_date === "" ? null : safeNum(patch.billed_to_date),
        paid_to_date: patch.paid_to_date === "" ? null : safeNum(patch.paid_to_date),
        currency: String(patch.currency || "USD").toUpperCase(),
      };

      const res = await jsonFetch(`/api/projects/${project.id}/financials`, {
        method: "PATCH",
        body: JSON.stringify(normalized),
      });
      setFinancials(res?.financials || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to save financials.");
    } finally {
      setBusy(false);
    }
  }

  async function addTeamMember(member_user_id: string, role: string | null) {
    setErr(null);
    setBusy(true);
    try {
      const res = await jsonFetch(`/api/projects/${project.id}/team`, {
        method: "POST",
        body: JSON.stringify({ member_user_id, role }),
      });
      const member = res?.member;
      if (member) {
        const member_name =
          assignees.find((a) => a.id === member.member_user_id)?.label || null;
        setTeam((prev) => [{ ...member, member_name }, ...prev]);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to add team member.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTeamMember(id: string) {
    setErr(null);
    setBusy(true);
    try {
      await jsonFetch(`/api/projects/${project.id}/team`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setTeam((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setErr(e?.message || "Failed to remove team member.");
    } finally {
      setBusy(false);
    }
  }

  async function createMilestone(payload: {
    title: string;
    description?: string | null;
    due_at?: string | null;
    status?: string;
  }) {
    setErr(null);
    setBusy(true);
    try {
      // IMPORTANT: Some DBs don’t have project_milestones.description yet.
      // Only include it if user typed something non-empty.
      const body: any = {
        title: payload.title,
        due_at: payload.due_at ?? null,
        status: payload.status ?? "Planned",
      };
      if (payload.description && payload.description.trim()) {
        body.description = payload.description.trim();
      }

      const res = await jsonFetch(`/api/projects/${project.id}/milestones`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const m = res?.milestone;
      if (m) setMilestones((prev) => [m, ...prev]);
    } catch (e: any) {
      setErr(e?.message || "Failed to create milestone.");
    } finally {
      setBusy(false);
    }
  }

  async function patchMilestone(id: string, patch: any) {
    setErr(null);
    setBusy(true);
    try {
      // Don’t send description unless user actually edited it.
      const body: any = { id, ...patch };
      if ("description" in body) {
        const v = body.description;
        if (typeof v === "string" && !v.trim()) delete body.description;
      }

      const res = await jsonFetch(`/api/projects/${project.id}/milestones`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const m = res?.milestone;
      if (m) setMilestones((prev) => prev.map((x) => (x.id === id ? m : x)));
    } catch (e: any) {
      setErr(e?.message || "Failed to update milestone.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMilestone(id: string) {
    setErr(null);
    setBusy(true);
    try {
      await jsonFetch(`/api/projects/${project.id}/milestones`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setErr(e?.message || "Failed to delete milestone.");
    } finally {
      setBusy(false);
    }
  }

  const canEdit = isStaff;

  return (
    <div className="space-y-6">
      {/* TOP: CEO DASH BAR */}
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Project</div>
            <div className="text-xl font-semibold">{project.name || project.id}</div>
            <div className="text-sm text-muted-foreground">
              Opportunity: {opportunityName || "N/A"} | Stage: {project.stage || "N/A"} | Status:{" "}
              {project.status || "N/A"} | Health: {project.health || "N/A"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={refreshAll}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              disabled={busy}
            >
              Refresh
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                } catch {}
              }}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              type="button"
            >
              Copy Link
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-6">
          <div className="rounded-2xl border p-4 md:col-span-2">
            <div className="text-xs text-muted-foreground">On-time signal</div>
            <div className="mt-1 text-lg font-semibold">{onTrackSignal.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{onTrackSignal.detail}</div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-gray-900" style={{ width: percent(onTrackSignal.score) }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Confidence score</div>
          </div>

          <div className="rounded-2xl border p-4 md:col-span-2">
            <div className="text-xs text-muted-foreground">Timeline</div>
            <div className="mt-1 text-sm">Start: {fmtDate(project.start_date)}</div>
            <div className="text-sm">Due: {fmtDate(project.due_date)}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-gray-900" style={{ width: `${timeline.has ? timeline.pct : 0}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {timeline.has
                ? `${timeline.pct}% elapsed | ${timeline.daysLeft ?? 0} days left`
                : "Add dates to compute progress"}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">Execution</div>
            <div className="mt-1 text-sm">New: {taskCounts["New"] || 0}</div>
            <div className="text-sm">In Progress: {taskCounts["In Progress"] || 0}</div>
            <div className="text-sm">Blocked: {taskCounts["Blocked"] || 0}</div>
            <div className="text-sm">Done: {taskCounts["Done"] || 0}</div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">Delivery</div>
            <div className="mt-1 text-sm">Team: {teamCount}</div>
            <div className="text-sm">Milestones: {milestones.length}</div>
            <div className="text-sm">Milestones done: {milestoneDonePct}%</div>
          </div>

          <div className="rounded-2xl border p-4 md:col-span-2">
            <div className="text-xs text-muted-foreground">Financial snapshot</div>
            <div className="mt-1 text-sm">
              Budget: {currency(financials?.budget_total ?? null, financials?.currency)}
            </div>
            <div className="text-sm">
              Cost: {currency(financials?.cost_to_date ?? null, financials?.currency)}
            </div>
            <div className="text-sm">
              Billed: {currency(financials?.billed_to_date ?? null, financials?.currency)}
            </div>
            <div className="text-sm">
              Paid: {currency(financials?.paid_to_date ?? null, financials?.currency)}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Budget burn</div>
                <div className="mt-1 text-sm font-semibold">
                  {burnPct === null ? "N/A" : `${Math.round(burnPct)}%`}
                </div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Collections</div>
                <div className="mt-1 text-sm font-semibold">
                  {collectPct === null ? "N/A" : `${Math.round(collectPct)}%`}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Description</div>
            <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {project.description || "No description yet."}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Internal notes</div>
            {!isStaff ? (
              <div className="mt-2 text-sm text-muted-foreground">Staff only.</div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {project.internal_notes || "No internal notes yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="rounded-2xl border bg-background p-2">
        <div className="flex flex-wrap gap-2 p-2">
          {(["Overview", "Tasks", "Updates", "Financials", "Team", "Milestones"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 ${
                tab === t ? "bg-gray-50" : ""
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      {tab === "Overview" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Milestones coming up</div>
                <div className="text-xs text-muted-foreground">
                  Next checkpoints that decide delivery.
                </div>
              </div>
              <button
                onClick={() => setTab("Milestones")}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                type="button"
              >
                View all
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {priorityMilestones.map((m) => (
                <div key={m.id} className="rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.status}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Due: {fmtDate(m.due_at)}</div>
                  {m.description ? (
                    <div className="mt-2 text-sm text-muted-foreground">{m.description}</div>
                  ) : null}
                </div>
              ))}
              {!milestones.length ? (
                <div className="text-sm text-muted-foreground">No milestones yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Team on this project</div>
                <div className="text-xs text-muted-foreground">
                  Ownership + accountability for delivery.
                </div>
              </div>
              <button
                onClick={() => setTab("Team")}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                type="button"
              >
                Manage
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {team.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{m.member_name || m.member_user_id}</div>
                    <div className="text-xs text-muted-foreground">{m.role || "Member"}</div>
                  </div>
                  {canEdit ? (
                    <button
                      onClick={() => removeTeamMember(m.id)}
                      className="rounded-2xl border px-3 py-1 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                      disabled={busy}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              {!team.length ? (
                <div className="text-sm text-muted-foreground">No team members assigned yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">What needs attention</div>
                <div className="text-xs text-muted-foreground">
                  A CEO-style scan for risk, blockers, and deadlines.
                </div>
              </div>
              <button
                onClick={() => setTab("Tasks")}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                type="button"
              >
                Go to Tasks
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border p-4">
                <div className="text-xs text-muted-foreground">Blocked tasks</div>
                <div className="mt-1 text-lg font-semibold">{taskCounts["Blocked"] || 0}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  If &gt; 0, this project is not safe.
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-xs text-muted-foreground">Due in 7 days</div>
                <div className="mt-1 text-lg font-semibold">
                  {
                    tasks.filter((t) => {
                      if (!t.due_at) return false;
                      const d = new Date(t.due_at);
                      if (isNaN(d.getTime())) return false;
                      const diff = daysBetween(today, d);
                      return diff >= 0 && diff <= 7 && String(t.status).toLowerCase() !== "done";
                    }).length
                  }
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Tasks that can break your deadline window.
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-xs text-muted-foreground">Budget burn</div>
                <div className="mt-1 text-lg font-semibold">
                  {burnPct === null ? "N/A" : `${Math.round(burnPct)}%`}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Cost-to-date vs budget.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* TASKS */}
      {tab === "Tasks" ? (
        <TasksPanel
          canEdit={canEdit}
          busy={busy}
          tasks={tasks}
          assignees={assignees}
          kanban={kanban}
          onCreate={createTask}
          onPatch={patchTask}
          onDelete={deleteTask}
        />
      ) : null}

      {/* UPDATES (NOW HAS A COMPOSER) */}
      {tab === "Updates" ? (
        <UpdatesPanel
          isStaff={isStaff}
          busy={busy}
          updates={updates}
          onCreate={createUpdate}
        />
      ) : null}

      {/* FINANCIALS */}
      {tab === "Financials" ? (
        <FinancialsPanel
          canEdit={canEdit}
          busy={busy}
          financials={financials}
          onSave={saveFinancials}
        />
      ) : null}

      {/* TEAM */}
      {tab === "Team" ? (
        <TeamPanel
          canEdit={canEdit}
          busy={busy}
          team={team}
          assignees={assignees}
          onAdd={addTeamMember}
          onRemove={removeTeamMember}
        />
      ) : null}

      {/* MILESTONES */}
      {tab === "Milestones" ? (
        <MilestonesPanel
          canEdit={canEdit}
          busy={busy}
          milestones={milestones}
          onCreate={createMilestone}
          onPatch={patchMilestone}
          onDelete={deleteMilestone}
        />
      ) : null}
    </div>
  );
}

function UpdatesPanel(props: {
  isStaff: boolean;
  busy: boolean;
  updates: UpdateRow[];
  onCreate: (p: {
    title?: string | null;
    body?: string | null;
    client_visible?: boolean;
    visibility?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [clientVisible, setClientVisible] = useState(false);

  return (
    <div className="rounded-2xl border bg-background p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold">Project updates</div>
        <div className="text-xs text-muted-foreground">
          Staff can publish updates. Clients see client-visible updates only.
        </div>
      </div>

      {!props.isStaff ? null : (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="text-sm font-semibold">Post an update</div>

          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Update title (optional)"
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={clientVisible}
                onChange={(e) => setClientVisible(e.target.checked)}
              />
              Client-visible
            </label>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the update. Keep it clear and outcome-focused."
            className="min-h-[140px] w-full rounded-2xl border px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              disabled={props.busy || !body.trim()}
              onClick={() => {
                props.onCreate({
                  title: title.trim() || null,
                  body: body.trim(),
                  client_visible: clientVisible,
                  visibility: clientVisible ? "client" : "internal",
                });
                setTitle("");
                setBody("");
                setClientVisible(false);
              }}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              type="button"
            >
              Publish
            </button>

            <button
              disabled={props.busy}
              onClick={() => {
                setTitle("");
                setBody("");
                setClientVisible(false);
              }}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {props.updates.map((u) => (
          <div key={u.id} className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{u.title || "Update"}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleString()} {u.author_name ? `| ${u.author_name}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {u.client_visible ? "Client-visible" : "Internal"}
              </div>
            </div>
            {u.body ? (
              <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {u.body}
              </div>
            ) : null}
          </div>
        ))}
        {!props.updates.length ? (
          <div className="text-sm text-muted-foreground">No updates yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function TasksPanel(props: {
  canEdit: boolean;
  busy: boolean;
  tasks: TaskRow[];
  assignees: AssigneeOption[];
  kanban: Record<TaskStatus, TaskRow[]>;
  onCreate: (p: {
    title: string;
    description?: string | null;
    due_at?: string | null;
    assigned_to?: string | null;
  }) => void;
  onPatch: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Create task</div>
            <div className="text-xs text-muted-foreground">
              Tasks drive delivery. Kanban is below.
            </div>
          </div>

          {!props.canEdit ? (
            <div className="text-sm text-muted-foreground">Staff only.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="rounded-2xl border px-3 py-2 text-sm"
              />
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="rounded-2xl border px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {props.assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <input
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                type="date"
                className="rounded-2xl border px-3 py-2 text-sm"
              />
              <button
                disabled={props.busy || !title.trim()}
                onClick={() => {
                  props.onCreate({
                    title: title.trim(),
                    assigned_to: assignedTo || null,
                    due_at: dueAt ? new Date(dueAt).toISOString() : null,
                  });
                  setTitle("");
                  setAssignedTo("");
                  setDueAt("");
                }}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                type="button"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-5">
        <div className="text-sm font-semibold">Kanban</div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {TASK_STATUSES.map((s) => (
            <div key={s} className="rounded-2xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{s}</div>
                <div className="text-xs text-muted-foreground">{props.kanban[s].length}</div>
              </div>

              <div className="mt-3 space-y-2">
                {props.kanban[s].map((t) => (
                  <div key={t.task_id} className="rounded-2xl border p-3">
                    <div className="text-sm font-semibold">{t.title || "Untitled"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Due: {fmtDate(t.due_at)} {t.assignee_name ? `| ${t.assignee_name}` : ""}
                    </div>

                    {props.canEdit ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <select
                          value={TASK_STATUSES.includes(t.status as any) ? (t.status as any) : "New"}
                          onChange={(e) => props.onPatch(t.task_id, { status: e.target.value })}
                          className="rounded-2xl border px-2 py-2 text-xs"
                        >
                          {TASK_STATUSES.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => props.onDelete(t.task_id)}
                          className="rounded-2xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                          disabled={props.busy}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}

                {!props.kanban[s].length ? (
                  <div className="text-sm text-muted-foreground">No tasks.</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-5">
        <div className="text-sm font-semibold">Task list</div>
        <div className="mt-3 space-y-2">
          {props.tasks.map((t) => (
            <div key={t.task_id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t.title || "Untitled"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Status: {String(t.status || "New")} | Due: {fmtDate(t.due_at)}{" "}
                    {t.assignee_name ? `| ${t.assignee_name}` : ""}
                  </div>
                  {t.description ? (
                    <div className="mt-2 text-sm text-muted-foreground">{t.description}</div>
                  ) : null}
                </div>

                {props.canEdit ? (
                  <div className="flex flex-col gap-2">
                    <select
                      value={TASK_STATUSES.includes(t.status as any) ? (t.status as any) : "New"}
                      onChange={(e) => props.onPatch(t.task_id, { status: e.target.value })}
                      className="rounded-2xl border px-3 py-2 text-sm"
                    >
                      {TASK_STATUSES.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>

                    <select
                      value={t.assigned_to || ""}
                      onChange={(e) => props.onPatch(t.task_id, { assigned_to: e.target.value || null })}
                      className="rounded-2xl border px-3 py-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {props.assignees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {!props.tasks.length ? (
            <div className="text-sm text-muted-foreground">No tasks yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FinancialsPanel(props: {
  canEdit: boolean;
  busy: boolean;
  financials: FinancialsRow;
  onSave: (patch: any) => void;
}) {
  const f = props.financials;
  const [budget, setBudget] = useState<string>(f?.budget_total?.toString() || "");
  const [cost, setCost] = useState<string>(f?.cost_to_date?.toString() || "");
  const [billed, setBilled] = useState<string>(f?.billed_to_date?.toString() || "");
  const [paid, setPaid] = useState<string>(f?.paid_to_date?.toString() || "");
  const [cur, setCur] = useState<string>(f?.currency || "USD");

  return (
    <div className="rounded-2xl border bg-background p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold">Financials</div>
        <div className="text-xs text-muted-foreground">
          Staff can edit. Clients see a read-only snapshot.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Budget</div>
          <div className="mt-1 text-sm font-semibold">{currency(f?.budget_total ?? null, f?.currency)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Cost to date</div>
          <div className="mt-1 text-sm font-semibold">{currency(f?.cost_to_date ?? null, f?.currency)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Billed</div>
          <div className="mt-1 text-sm font-semibold">{currency(f?.billed_to_date ?? null, f?.currency)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="mt-1 text-sm font-semibold">{currency(f?.paid_to_date ?? null, f?.currency)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Currency</div>
          <div className="mt-1 text-sm font-semibold">{f?.currency || "USD"}</div>
        </div>
      </div>

      {!props.canEdit ? null : (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="text-sm font-semibold">Edit financials</div>
          <div className="grid gap-2 md:grid-cols-5">
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Cost to date" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={billed} onChange={(e) => setBilled(e.target.value)} placeholder="Billed" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="Paid" className="rounded-2xl border px-3 py-2 text-sm" />
            <input value={cur} onChange={(e) => setCur(e.target.value)} placeholder="USD" className="rounded-2xl border px-3 py-2 text-sm" />
          </div>
          <button
            disabled={props.busy}
            onClick={() =>
              props.onSave({
                budget_total: budget,
                cost_to_date: cost,
                billed_to_date: billed,
                paid_to_date: paid,
                currency: cur || "USD",
              })
            }
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            type="button"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function TeamPanel(props: {
  canEdit: boolean;
  busy: boolean;
  team: TeamMemberRow[];
  assignees: AssigneeOption[];
  onAdd: (member_user_id: string, role: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const [member, setMember] = useState("");
  const [role, setRole] = useState("");

  return (
    <div className="rounded-2xl border bg-background p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold">Team</div>
        <div className="text-xs text-muted-foreground">
          Assign who is responsible for delivery on this project.
        </div>
      </div>

      {props.canEdit ? (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="text-sm font-semibold">Add team member</div>
          <div className="grid gap-2 md:grid-cols-3">
            <select value={member} onChange={(e) => setMember(e.target.value)} className="rounded-2xl border px-3 py-2 text-sm">
              <option value="">Select person</option>
              {props.assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role on project" className="rounded-2xl border px-3 py-2 text-sm" />
            <button
              disabled={props.busy || !member}
              onClick={() => {
                props.onAdd(member, role.trim() || null);
                setMember("");
                setRole("");
              }}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              type="button"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {props.team.map((m) => (
          <div key={m.id} className="rounded-2xl border p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{m.member_name || m.member_user_id}</div>
              <div className="text-xs text-muted-foreground">{m.role || "Member"}</div>
            </div>
            {props.canEdit ? (
              <button
                onClick={() => props.onRemove(m.id)}
                disabled={props.busy}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                type="button"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {!props.team.length ? <div className="text-sm text-muted-foreground">No team members yet.</div> : null}
      </div>
    </div>
  );
}

function MilestonesPanel(props: {
  canEdit: boolean;
  busy: boolean;
  milestones: MilestoneRow[];
  onCreate: (p: { title: string; description?: string | null; due_at?: string | null; status?: string }) => void;
  onPatch: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState("Planned");
  const [description, setDescription] = useState("");

  const STATUSES = ["Planned", "In Progress", "Done", "Blocked"];

  return (
    <div className="rounded-2xl border bg-background p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold">Milestones</div>
        <div className="text-xs text-muted-foreground">
          Big checkpoints that map to delivery.
        </div>
      </div>

      {props.canEdit ? (
        <div className="rounded-2xl border p-4 space-y-3">
          <div className="text-sm font-semibold">Create milestone</div>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone title"
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <input
              value={due}
              onChange={(e) => setDue(e.target.value)}
              type="date"
              className="rounded-2xl border px-3 py-2 text-sm"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-2xl border px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              disabled={props.busy || !title.trim()}
              onClick={() => {
                props.onCreate({
                  title: title.trim(),
                  // Only send description if user typed it (avoids schema cache error if column doesn't exist)
                  description: description.trim() ? description.trim() : undefined,
                  due_at: due ? new Date(due).toISOString() : null,
                  status,
                });
                setTitle("");
                setDue("");
                setStatus("Planned");
                setDescription("");
              }}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              type="button"
            >
              Add
            </button>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Milestone description (optional)"
            className="min-h-[90px] w-full rounded-2xl border px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {props.milestones.map((m) => (
          <div key={m.id} className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">Due: {fmtDate(m.due_at)}</div>
                {m.description ? (
                  <div className="mt-2 text-sm text-muted-foreground">{m.description}</div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs text-muted-foreground">{m.status}</div>

                {props.canEdit ? (
                  <>
                    <select
                      value={m.status}
                      onChange={(e) => props.onPatch(m.id, { status: e.target.value })}
                      className="rounded-2xl border px-3 py-2 text-sm"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => props.onDelete(m.id)}
                      disabled={props.busy}
                      className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                      type="button"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {!props.milestones.length ? <div className="text-sm text-muted-foreground">No milestones yet.</div> : null}
      </div>
    </div>
  );
}
