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

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // Load project (account-scoped)
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select(
      "id, opportunity_id, name, status, stage, start_date, due_date, owner_user_id, created_at, health, account_id, description, internal_notes"
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
        <PageHeader title="Project Not Found" subtitle="This project does not exist or you do not have access." />
        <div className="rounded-2xl border bg-background p-6 text-sm space-y-3">
          <div>
            If this is a new project created from a won opportunity, confirm the project has account_id set to your
            current account.
          </div>
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

  // Opportunity label
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

  // Tasks for this project (account-scoped)
  const { data: tasksData } = await supabase
    .from("tasks")
    .select("task_id, title, description, status, due_at, assigned_to")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false });

  const tasks = ((tasksData || []) as unknown as TaskRow[]) || [];

  // Assignee names
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

  // Updates (client-visible filtered if not staff)
  const { data: updatesRaw } = await supabase
    .from("project_updates")
    .select("id, project_id, account_id, created_by, created_at, title, body, client_visible")
    .eq("account_id", accountId)
    .eq("project_id", proj.id)
    .order("created_at", { ascending: false });

  const updatesAll = ((updatesRaw || []) as unknown as UpdateRow[]) || [];
  const updatesVisible = staff ? updatesAll : updatesAll.filter((u) => !!u.client_visible);

  // Author names
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

  return (
    <>
      <PageHeader
        title="Project"
        subtitle="Track stage, updates, and tasks."
        right={
          <Link
            href="/dashboard/projects"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Back to Projects
          </Link>
        }
      />

      <ProjectClient
        viewerRole={profile.role || "STAFF"}
        viewerAccountId={accountId}
        isStaff={staff}
        project={proj}
        opportunityName={opportunityName}
        initialTasks={initialTasks}
        initialUpdates={initialUpdates}
      />
    </>
  );
}
