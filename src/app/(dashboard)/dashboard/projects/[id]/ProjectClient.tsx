"use client";

import { useEffect, useMemo, useState } from "react";

type TaskStatus = "New" | "In Progress" | "Done" | "Blocked";

type ProjectRow = {
  id: string;
  opportunity_id: string | null;
  company_id: string | null;
  name: string | null;
  status: string | null;
  stage: string | null;
  start_date: string | null;
  due_date: string | null;
  support_cost?: number | null;
  support_due_date?: string | null;
  delivery_cost?: number | null;
  support_monthly_cost?: number | null;
  support_start_date?: string | null;
  support_next_due_date?: string | null;
  support_status?: string | null;
  progress_percent?: number | null;
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
  description?: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
};

const TASK_STATUSES: TaskStatus[] = ["New", "In Progress", "Done", "Blocked"];
const PROJECT_STAGE_OPTIONS = [
  "Intake",
  "Planning",
  "Design",
  "Development",
  "QA",
  "Launch",
  "Support",
] as const;
const PROJECT_STATUS_OPTIONS = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "canceled",
] as const;
const HEALTH_OPTIONS = ["GREEN", "YELLOW", "RED", "UNKNOWN"] as const;
const SUPPORT_STATUS_OPTIONS = [
  "inactive",
  "active",
  "overdue",
  "paused",
  "canceled",
] as const;

function fmtDate(s: string | null | undefined) {
  if (!s) return "N/A";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function dateInputValue(v: string | null | undefined) {
  if (!v) return "";
  return String(v).slice(0, 10);
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

function chipClasses(label: string | null | undefined, kind: "health" | "status" | "support" | "stage") {
  const v = String(label || "").toUpperCase();

  if (kind === "health") {
    if (v === "GREEN") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (v === "YELLOW") return "border-amber-200 bg-amber-50 text-amber-800";
    if (v === "RED") return "border-red-200 bg-red-50 text-red-800";
    return "border-gray-200 bg-gray-50 text-gray-700";
  }

  if (kind === "status") {
    if (v === "ACTIVE") return "border-blue-200 bg-blue-50 text-blue-800";
    if (v === "ON_HOLD") return "border-amber-200 bg-amber-50 text-amber-800";
    if (v === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (v === "CANCELED") return "border-red-200 bg-red-50 text-red-800";
    return "border-gray-200 bg-gray-50 text-gray-700";
  }

  if (kind === "support") {
    if (v === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (v === "OVERDUE") return "border-red-200 bg-red-50 text-red-800";
    if (v === "PAUSED") return "border-amber-200 bg-amber-50 text-amber-800";
    if (v === "CANCELED") return "border-gray-200 bg-gray-100 text-gray-700";
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (v === "SUPPORT") return "border-violet-200 bg-violet-50 text-violet-800";
  if (v === "LAUNCH") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (v === "QA") return "border-orange-200 bg-orange-50 text-orange-800";
  if (v === "DEVELOPMENT") return "border-blue-200 bg-blue-50 text-blue-800";
  if (v === "DESIGN") return "border-pink-200 bg-pink-50 text-pink-800";
  if (v === "PLANNING") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (v === "INTAKE") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function prettyLabel(v: string | null | undefined) {
  if (!v) return "N/A";
  return v.replaceAll("_", " ");
}

export default function ProjectClient(props: {
  viewerRole: string;
  viewerAccountId: string;
  isStaff: boolean;
  project: ProjectRow;
  company: { id: string; name: string | null } | null;
  opportunityName: string | null;
  initialTasks: TaskRow[];
  initialUpdates: UpdateRow[];
  assignees: AssigneeOption[];
  initialFinancials: FinancialsRow;
  initialTeam: TeamMemberRow[];
  initialMilestones: MilestoneRow[];
}) {
  const { isStaff, opportunityName, assignees, company } = props;

  const [project, setProject] = useState<ProjectRow>(props.project);
  const [tab, setTab] = useState<
    "Overview" | "Tasks" | "Updates" | "Financials" | "Team" | "Milestones"
  >("Overview");

  const [tasks, setTasks] = useState<TaskRow[]>(props.initialTasks || []);
  const [updates, setUpdates] = useState<UpdateRow[]>(props.initialUpdates || []);
  const [financials, setFinancials] = useState<FinancialsRow>(props.initialFinancials || null);
  const [team, setTeam] = useState<TeamMemberRow[]>(props.initialTeam || []);
  const [milestones, setMilestones] = useState<MilestoneRow[]>(props.initialMilestones || []);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    setProject(props.project);
  }, [props.project]);

  const projectStart = project.start_date ? new Date(project.start_date) : null;
  const projectDue = project.due_date ? new Date(project.due_date) : null;
  const supportDue = project.support_next_due_date
    ? new Date(project.support_next_due_date)
    : project.support_due_date
    ? new Date(project.support_due_date)
    : null;

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

  const overallProgress = useMemo(() => {
    if (project.progress_percent !== null && project.progress_percent !== undefined) {
      return clamp(Number(project.progress_percent) || 0, 0, 100);
    }
    if (timeline.has) return timeline.pct;
    return 0;
  }, [project.progress_percent, timeline]);

  const supportDaysLeft = useMemo(() => {
    if (!supportDue || isNaN(supportDue.getTime())) return null;
    return daysBetween(today, supportDue);
  }, [project.support_next_due_date, project.support_due_date]);

  const supportMonthlyCost = useMemo(() => {
    return project.support_monthly_cost ?? project.support_cost ?? null;
  }, [project.support_monthly_cost, project.support_cost]);

  const supportRisk = useMemo(() => {
    const status = String(project.support_status || "").toLowerCase();
    if (status === "overdue") return "Overdue";
    if (status === "paused") return "Paused";
    if (supportDaysLeft !== null && supportDaysLeft < 0) return "Overdue";
    if (supportDaysLeft !== null && supportDaysLeft <= 7) return "Due Soon";
    if (status === "active") return "Healthy";
    return "Unknown";
  }, [project.support_status, supportDaysLeft]);

  const canEdit = isStaff;

  async function refreshAll() {
    setErr(null);
    setBusy(true);
    try {
      const pid = project.id;

      const [p, t, u, f, tm, ms] = await Promise.all([
        jsonFetch(`/api/projects/${pid}`),
        jsonFetch(`/api/tasks?project_id=${encodeURIComponent(pid)}`),
        jsonFetch(`/api/projects/${pid}/updates`),
        jsonFetch(`/api/projects/${pid}/financials`),
        jsonFetch(`/api/projects/${pid}/team`),
        jsonFetch(`/api/projects/${pid}/milestones`),
      ]);

      setProject(p?.project || project);
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

  async function saveProjectCore() {
    setErr(null);
    setSavingProject(true);
    try {
      const res = await jsonFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: project.name,
          stage: project.stage,
          status: project.status,
          health: project.health,
          start_date: project.start_date,
          due_date: project.due_date,
          progress_percent: project.progress_percent,
          delivery_cost: project.delivery_cost,
          support_cost: supportMonthlyCost,
          support_monthly_cost: supportMonthlyCost,
          support_start_date: project.support_start_date,
          support_due_date: project.support_next_due_date || project.support_due_date,
          support_next_due_date: project.support_next_due_date || project.support_due_date,
          support_status: project.support_status,
          description: project.description,
          internal_notes: project.internal_notes,
        }),
      });

      if (res?.project) {
        setProject(res.project);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to save project.");
    } finally {
      setSavingProject(false);
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
          message: payload.body ?? null,
          client_visible: Boolean(payload.client_visible),
          visibility: payload.visibility || (payload.client_visible ? "client" : "internal"),
        }),
      });

      const created = res?.update;
      if (created) {
        setUpdates((prev) => [created, ...prev]);
      } else {
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

  return (
    <div className="space-y-6">
      {/* TOP: FRESHWARE COMMAND BAR */}
      <div className="rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Freshware Project Command Center</div>
            <div className="text-2xl font-semibold">{project.name || project.id}</div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClasses(project.stage, "stage")}`}>
                {prettyLabel(project.stage)}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClasses(project.status, "status")}`}>
                {prettyLabel(project.status)}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClasses(project.health, "health")}`}>
                {prettyLabel(project.health)}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClasses(project.support_status, "support")}`}>
                Support: {prettyLabel(project.support_status)}
              </span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
  <div>Opportunity: {opportunityName || "N/A"}</div>
  <div>
    Company:{" "}
    {company ? (
      <a
        href={`/dashboard/companies/${company.id}`}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {company.name || "Company"}
      </a>
    ) : (
      "N/A"
    )}
  </div>
</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveProjectCore}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              disabled={savingProject}
              type="button"
            >
              {savingProject ? "Saving..." : "Save Project"}
            </button>
            <button
              onClick={refreshAll}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              disabled={busy}
              type="button"
            >
              {busy ? "Refreshing..." : "Refresh"}
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

        {/* EXECUTIVE METRICS */}
        <div className="mt-5 grid gap-3 lg:grid-cols-12">
          <div className="rounded-2xl border p-4 lg:col-span-3">
            <div className="text-xs text-muted-foreground">Overall progress</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-2xl font-semibold">{overallProgress}%</div>
              <div className="text-xs text-muted-foreground">manual executive control</div>
            </div>
            <div className="mt-3 h-3 w-full rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-gray-900" style={{ width: `${overallProgress}%` }} />
            </div>
            {canEdit ? (
              <input
                type="range"
                min={0}
                max={100}
                value={overallProgress}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    progress_percent: clamp(Number(e.target.value) || 0, 0, 100),
                  }))
                }
                className="mt-3 w-full"
              />
            ) : null}
          </div>

          <div className="rounded-2xl border p-4 lg:col-span-3">
            <div className="text-xs text-muted-foreground">On-time signal</div>
            <div className="mt-1 text-lg font-semibold">{onTrackSignal.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{onTrackSignal.detail}</div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-gray-900" style={{ width: percent(onTrackSignal.score) }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Confidence score</div>
          </div>

          <div className="rounded-2xl border p-4 lg:col-span-3">
            <div className="text-xs text-muted-foreground">Delivery</div>
            <div className="mt-1 text-sm">Start: {fmtDate(project.start_date)}</div>
            <div className="text-sm">Due: {fmtDate(project.due_date)}</div>
            <div className="text-sm">Delivery cost: {currency(project.delivery_cost ?? null, financials?.currency)}</div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-gray-900" style={{ width: `${timeline.has ? timeline.pct : 0}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {timeline.has
                ? `${timeline.pct}% elapsed | ${timeline.daysLeft ?? 0} days left`
                : "Add dates to compute progress"}
            </div>
          </div>

          <div className="rounded-2xl border p-4 lg:col-span-3">
            <div className="text-xs text-muted-foreground">Support lifecycle</div>
            <div className="mt-1 text-sm">
              Monthly: {currency(supportMonthlyCost, financials?.currency)}
            </div>
            <div className="text-sm">Next due: {fmtDate(project.support_next_due_date || project.support_due_date)}</div>
            <div className="text-sm">Status: {prettyLabel(project.support_status)}</div>
            <div className="mt-2 text-lg font-semibold">{supportRisk}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {supportDaysLeft === null
                ? "No next support due date set."
                : supportDaysLeft < 0
                ? `${Math.abs(supportDaysLeft)} days overdue`
                : `${supportDaysLeft} days until next support due`}
            </div>
          </div>

          <div className="rounded-2xl border p-4 lg:col-span-2">
            <div className="text-xs text-muted-foreground">Execution</div>
            <div className="mt-1 text-sm">New: {taskCounts["New"] || 0}</div>
            <div className="text-sm">In Progress: {taskCounts["In Progress"] || 0}</div>
            <div className="text-sm">Blocked: {taskCounts["Blocked"] || 0}</div>
            <div className="text-sm">Done: {taskCounts["Done"] || 0}</div>
          </div>

          <div className="rounded-2xl border p-4 lg:col-span-2">
            <div className="text-xs text-muted-foreground">Delivery team</div>
            <div className="mt-1 text-sm">Team: {teamCount}</div>
            <div className="text-sm">Milestones: {milestones.length}</div>
            <div className="text-sm">Milestones done: {milestoneDonePct}%</div>
          </div>

          <div className="rounded-2xl border p-4 lg:col-span-4">
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

          <div className="rounded-2xl border p-4 lg:col-span-4">
            <div className="text-xs text-muted-foreground">What needs attention</div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Blocked tasks</div>
                <div className="mt-1 text-lg font-semibold">{taskCounts["Blocked"] || 0}</div>
              </div>

              <div className="rounded-2xl border p-3">
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
              </div>

              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Support invoices at risk</div>
                <div className="mt-1 text-lg font-semibold">
                  {supportDaysLeft !== null && supportDaysLeft < 0 ? 1 : 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INLINE EDITABLE CORE */}
        {canEdit ? (
          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border p-4 space-y-3 xl:col-span-2">
              <div className="text-sm font-semibold">Project controls</div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Stage</div>
                  <select
                    value={project.stage || ""}
                    onChange={(e) =>
                      setProject((prev) => ({ ...prev, stage: e.target.value || null }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    {PROJECT_STAGE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Status</div>
                  <select
                    value={project.status || ""}
                    onChange={(e) =>
                      setProject((prev) => ({ ...prev, status: e.target.value || null }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    {PROJECT_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Health</div>
                  <select
                    value={project.health || ""}
                    onChange={(e) =>
                      setProject((prev) => ({ ...prev, health: e.target.value || null }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    {HEALTH_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Start date</div>
                  <input
                    type="date"
                    value={dateInputValue(project.start_date)}
                    onChange={(e) =>
                      setProject((prev) => ({ ...prev, start_date: e.target.value || null }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Due date</div>
                  <input
                    type="date"
                    value={dateInputValue(project.due_date)}
                    onChange={(e) =>
                      setProject((prev) => ({ ...prev, due_date: e.target.value || null }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Delivery cost</div>
                  <input
                    value={project.delivery_cost ?? ""}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        delivery_cost: e.target.value === "" ? null : safeNum(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                    placeholder="12000"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Support monthly</div>
                  <input
                    value={supportMonthlyCost ?? ""}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        support_monthly_cost: e.target.value === "" ? null : safeNum(e.target.value),
                        support_cost: e.target.value === "" ? null : safeNum(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                    placeholder="400"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Support start</div>
                  <input
                    type="date"
                    value={dateInputValue(project.support_start_date)}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        support_start_date: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Support next due</div>
                  <input
                    type="date"
                    value={dateInputValue(project.support_next_due_date || project.support_due_date)}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        support_next_due_date: e.target.value || null,
                        support_due_date: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Support status</div>
                  <select
                    value={project.support_status || "inactive"}
                    onChange={(e) =>
                      setProject((prev) => ({
                        ...prev,
                        support_status: e.target.value || null,
                      }))
                    }
                    className="w-full rounded-2xl border px-3 py-2 text-sm"
                  >
                    {SUPPORT_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
              <div className="text-sm font-semibold">Executive progress control</div>
              <div className="text-xs text-muted-foreground">
                Use this for the real overall project completion signal, separate from timeline math.
              </div>

              <div className="text-3xl font-semibold">{overallProgress}%</div>
              <div className="h-3 w-full rounded-full bg-gray-100">
                <div className="h-3 rounded-full bg-gray-900" style={{ width: `${overallProgress}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={overallProgress}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    progress_percent: clamp(Number(e.target.value) || 0, 0, 100),
                  }))
                }
                className="w-full"
              />
              <button
                onClick={saveProjectCore}
                className="w-full rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                disabled={savingProject}
                type="button"
              >
                {savingProject ? "Saving..." : "Save Core Fields"}
              </button>
            </div>
          </div>
        ) : null}
<div className="mt-5 rounded-2xl border p-4">
  <div className="text-sm font-semibold">Customer company</div>
  <div className="mt-2 text-sm text-muted-foreground">
    {company ? (
      <a
        href={`/dashboard/companies/${company.id}`}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {company.name || "Company"}
      </a>
    ) : (
      "This project is not linked to a company yet."
    )}
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
                  A CEO-style scan for risk, blockers, deadlines, and support billing.
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

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border p-4">
                <div className="text-xs text-muted-foreground">Blocked tasks</div>
                <div className="mt-1 text-lg font-semibold">{taskCounts["Blocked"] || 0}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  If &gt; 0, delivery is not safe.
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

              <div className="rounded-2xl border p-4">
                <div className="text-xs text-muted-foreground">Support risk</div>
                <div className="mt-1 text-lg font-semibold">{supportRisk}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {supportDaysLeft === null
                    ? "Set support next due date."
                    : supportDaysLeft < 0
                    ? `${Math.abs(supportDaysLeft)} days overdue`
                    : `${supportDaysLeft} days until support due`}
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

      {/* UPDATES */}
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
          deliveryCost={project.delivery_cost ?? null}
          supportMonthlyCost={supportMonthlyCost}
          supportStatus={project.support_status ?? null}
          supportNextDueDate={project.support_next_due_date || project.support_due_date || null}
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
  deliveryCost: number | null;
  supportMonthlyCost: number | null;
  supportStatus: string | null;
  supportNextDueDate: string | null;
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
          Delivery, collections, and support economics in one place.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Delivery cost</div>
          <div className="mt-1 text-sm font-semibold">{currency(props.deliveryCost ?? null, f?.currency)}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground">Support monthly</div>
          <div className="mt-1 text-sm font-semibold">{currency(props.supportMonthlyCost ?? null, f?.currency)}</div>
        </div>
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
          <div className="text-xs text-muted-foreground">Support</div>
          <div className="mt-1 text-sm font-semibold">{prettyLabel(props.supportStatus)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{fmtDate(props.supportNextDueDate)}</div>
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