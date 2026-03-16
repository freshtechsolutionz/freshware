import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import ProjectClient from "./ProjectClient";

export const runtime = "nodejs";

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

type FinancialsRow = {
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
};

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
  description: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
};

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/projects/${id}`);

  const viewerId = auth.user.id;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, account_id")
    .eq("id", viewerId)
    .maybeSingle();

  if (profErr || !profile) {
    return (
      <>
        <PageHeader title="Project" subtitle="Unable to load viewer profile." />
        <div className="rounded-2xl border bg-background p-6 text-sm">
          {profErr?.message || "Missing profile."}
        </div>
      </>
    );
  }

  if (!profile.account_id) {
    return (
      <>
        <PageHeader title="Project" subtitle="Missing account assignment." />
        <div className="rounded-2xl border bg-background p-6 text-sm">
          Your profile is missing an account assignment (profiles.account_id).
        </div>
      </>
    );
  }

  const accountId = profile.account_id;
  const staff = isStaff(profile.role);

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select(
      "id, opportunity_id, company_id, name, status, stage, start_date, due_date, owner_user_id, created_at, health, account_id, description, internal_notes"
    )
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (projErr) {
    return (
      <>
        <PageHeader title="Project" subtitle="Unable to load project." />
        <div className="rounded-2xl border bg-background p-6 text-sm">
          Error loading project: {projErr.message}
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <PageHeader
          title="Project Not Found"
          subtitle="This project does not exist or you do not have access."
        />
        <div className="rounded-2xl border bg-background p-6 text-sm space-y-3">
          <Link
            href="/dashboard/projects"
            className="inline-flex rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Back to Projects
          </Link>
        </div>
      </>
    );
  }

  const proj = project as unknown as ProjectRow;

  let opportunityName: string | null = null;
  if (proj.opportunity_id) {
    const oppRes = await supabase
      .from("opportunities")
      .select("id, name")
      .eq("id", proj.opportunity_id)
      .eq("account_id", accountId)
      .maybeSingle();

    if (!oppRes.error && oppRes.data) {
      opportunityName = (oppRes.data as any).name || (oppRes.data as any).id;
    }
  }

  let company: { id: string; name: string | null } | null = null;
  if (proj.company_id) {
    const companyRes = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", proj.company_id)
      .eq("account_id", accountId)
      .maybeSingle();

    if (!companyRes.error && companyRes.data) {
      company = {
        id: companyRes.data.id,
        name: (companyRes.data as any).name || "Company",
      };
    }
  }

  const { data: assigneesRaw } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("account_id", accountId)
    .neq("role", "PENDING")
    .order("full_name", { ascending: true });

  const assignees: AssigneeOption[] = ((assigneesRaw || []) as any[]).map((p) => ({
    id: p.id,
    label: p.full_name || p.id,
  }));

  const { data: tasksData } = await supabase
    .from("tasks")
    .select("task_id, title, description, status, due_at, assigned_to")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false });

  const tasks = ((tasksData || []) as unknown as TaskRow[]) || [];

  const userIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean))) as string[];
  const userMap: Record<string, string> = {};

  if (userIds.length) {
    const usersRes = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds)
      .eq("account_id", accountId);

    if (!usersRes.error) {
      for (const u of (usersRes.data || []) as any[]) {
        userMap[u.id] = u.full_name || u.id;
      }
    }
  }

  const initialTasks = tasks.map((t) => ({
    ...t,
    assignee_name: t.assigned_to ? userMap[t.assigned_to] || null : null,
  }));

  const { data: updatesRaw } = await supabase
    .from("project_updates")
    .select("id, project_id, account_id, created_by, created_at, title, body, client_visible")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false });

  const updatesAll = ((updatesRaw || []) as unknown as UpdateRow[]) || [];
  const updatesVisible = staff ? updatesAll : updatesAll.filter((u) => !!u.client_visible);

  const authorIds = Array.from(new Set(updatesVisible.map((u) => u.created_by).filter(Boolean))) as string[];
  const authorMap: Record<string, string> = {};

  if (authorIds.length) {
    const authorsRes = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds)
      .eq("account_id", accountId);

    if (!authorsRes.error) {
      for (const a of (authorsRes.data || []) as any[]) {
        authorMap[a.id] = a.full_name || a.id;
      }
    }
  }

  const initialUpdates = updatesVisible.map((u) => ({
    ...u,
    author_name: u.created_by ? authorMap[u.created_by] || null : null,
  }));

  const { data: fin } = await supabase
    .from("project_financials")
    .select("id, account_id, project_id, budget_total, cost_to_date, billed_to_date, paid_to_date, currency, updated_at, created_at")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .maybeSingle();

  const { data: teamRaw } = await supabase
    .from("project_team_members")
    .select("id, account_id, project_id, member_user_id, role, created_at")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false });

  const team = ((teamRaw || []) as unknown as TeamMemberRow[]) || [];
  const teamIds = Array.from(new Set(team.map((t) => t.member_user_id).filter(Boolean))) as string[];

  const teamNameMap: Record<string, string> = {};
  if (teamIds.length) {
    const teamRes = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", teamIds)
      .eq("account_id", accountId);

    if (!teamRes.error) {
      for (const p of (teamRes.data || []) as any[]) {
        teamNameMap[p.id] = p.full_name || p.id;
      }
    }
  }

  const initialTeam = team.map((m) => ({
    ...m,
    member_name: teamNameMap[m.member_user_id] || null,
  }));

  const { data: milestonesRaw } = await supabase
    .from("project_milestones")
    .select("id, account_id, project_id, title, description, due_at, status, created_at")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false });

  const initialMilestones = ((milestonesRaw || []) as unknown as MilestoneRow[]) || [];

  return (
    <>
      <PageHeader
        title="Project"
        subtitle="CEO command center for delivery, health, updates, team, milestones, and financials."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/projects/${id}/edit`}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Edit Project
            </Link>
            <Link
              href="/dashboard/projects"
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Back to Projects
            </Link>
          </div>
        }
      />

      <ProjectClient
        viewerRole={profile.role || "STAFF"}
        viewerAccountId={accountId}
        isStaff={staff}
        project={proj}
        company={company}
        opportunityName={opportunityName}
        initialTasks={initialTasks}
        initialUpdates={initialUpdates}
        assignees={assignees}
        initialFinancials={(fin as any) || null}
        initialTeam={initialTeam}
        initialMilestones={initialMilestones}
      />
    </>
  );
}