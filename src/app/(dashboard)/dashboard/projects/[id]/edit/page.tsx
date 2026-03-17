import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabaseServer } from "@/lib/supabase/server";
import EditProjectForm from "@/components/projects/EditProjectForm";

export const runtime = "nodejs";

type ProjectRow = {
  id: string;
  opportunity_id: string | null;
  name: string | null;
  status: string | null;
  stage: string | null;
  start_date: string | null;
  due_date: string | null;
  support_cost: number | null;
  support_due_date: string | null;
  delivery_cost: number | null;
  support_monthly_cost: number | null;
  support_start_date: string | null;
  support_next_due_date: string | null;
  support_status: string | null;
  progress_percent: number | null;
  owner_user_id: string | null;
  created_at: string | null;
  health: string | null;
  account_id: string | null;
  description: string | null;
  internal_notes: string | null;
};

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
} | null;

type Option = {
  id: string;
  label: string;
};

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/projects/${id}/edit`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <>
        <PageHeader title="Edit Project" subtitle="Missing account assignment." />
        <div className="rounded-2xl border bg-background p-6 text-sm">
          Your profile is missing account_id.
        </div>
      </>
    );
  }

  if (!isStaff(profile.role)) {
    return (
      <>
        <PageHeader title="Edit Project" subtitle="Staff only." />
        <div className="rounded-2xl border bg-background p-6 text-sm">
          You do not have permission to edit projects.
        </div>
      </>
    );
  }

  const accountId = profile.account_id;

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select(
      "id, opportunity_id, name, status, stage, start_date, due_date, support_cost, support_due_date, delivery_cost, support_monthly_cost, support_start_date, support_next_due_date, support_status, progress_percent, owner_user_id, created_at, health, account_id, description, internal_notes"
    )
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (projErr) {
    return (
      <>
        <PageHeader title="Edit Project" subtitle="Unable to load project." />
        <div className="rounded-2xl border bg-background p-6 text-sm">
          {projErr.message}
        </div>
      </>
    );
  }

  if (!project) notFound();

  const { data: financials } = await supabase
    .from("project_financials")
    .select(
      "id, project_id, account_id, budget_total, cost_to_date, billed_to_date, paid_to_date, currency, updated_at, created_at"
    )
    .eq("account_id", accountId)
    .eq("project_id", id)
    .maybeSingle();

  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("account_id", accountId)
    .neq("role", "PENDING")
    .order("full_name", { ascending: true });

  const ownerOptions: Option[] = ((profilesRaw || []) as any[]).map((p) => ({
    id: p.id,
    label: p.full_name || p.id,
  }));

  const { data: oppRaw } = await supabase
    .from("opportunities")
    .select("id, name, stage")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const opportunityOptions: Option[] = ((oppRaw || []) as any[]).map((o) => ({
    id: o.id,
    label: `${o.name || o.id}${o.stage ? ` • ${o.stage}` : ""}`,
  }));

  async function deleteProjectAction() {
    "use server";

    const supabase = await supabaseServer();

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect(`/portal?next=/dashboard/projects/${id}/edit`);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_id")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (!profile?.account_id) {
      throw new Error("Missing account_id.");
    }

    if (!isStaff(profile.role)) {
      throw new Error("Staff only.");
    }

    const accountId = profile.account_id;

    const { data: existing, error: existingErr } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .eq("account_id", accountId)
      .maybeSingle();

    if (existingErr) throw new Error(existingErr.message);
    if (!existing) throw new Error("Project not found.");

    const deletions = await Promise.all([
      supabase.from("tasks").delete().eq("account_id", accountId).eq("project_id", id),
      supabase.from("project_updates").delete().eq("account_id", accountId).eq("project_id", id),
      supabase.from("project_milestones").delete().eq("account_id", accountId).eq("project_id", id),
      supabase.from("project_team_members").delete().eq("account_id", accountId).eq("project_id", id),
      supabase.from("project_financials").delete().eq("account_id", accountId).eq("project_id", id),
      supabase.from("revenue_entries").delete().eq("account_id", accountId).eq("project_id", id),
    ]);

    for (const result of deletions) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    const { error: deleteProjectErr } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId);

    if (deleteProjectErr) {
      throw new Error(deleteProjectErr.message);
    }

    redirect("/dashboard/projects");
  }

  return (
    <>
      <PageHeader
        title="Edit Project"
        subtitle="Update delivery, support, health, dates, owner, and financials."
      />

      <div className="space-y-6">
        <EditProjectForm
          initial={project as ProjectRow}
          initialFinancials={(financials as FinancialsRow) || null}
          ownerOptions={ownerOptions}
          opportunityOptions={opportunityOptions}
        />

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="text-sm font-semibold text-red-900">Danger Zone</div>
          <div className="mt-2 text-sm text-red-800">
            Deleting this project will also remove its tasks, updates, milestones, team members,
            financials, and project-linked revenue entries. This is useful for cleaning up test
            projects, but it cannot be undone.
          </div>

          <form action={deleteProjectAction} className="mt-4">
            <button
              type="submit"
              className="rounded-2xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Delete Project
            </button>
          </form>
        </div>
      </div>
    </>
  );
}