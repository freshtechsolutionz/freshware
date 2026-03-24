import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabaseServer } from "@/lib/supabase/server";
import EditProjectForm from "@/components/projects/EditProjectForm";

export const runtime = "nodejs";

type ProjectRow = {
  id: string;
  opportunity_id: string | null;
  company_id: string | null;
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

  const accountId = profile.account_id;

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select(
      "id, opportunity_id, company_id, name, status, stage, start_date, due_date, support_cost, support_due_date, delivery_cost, support_monthly_cost, support_start_date, support_next_due_date, support_status, progress_percent, owner_user_id, created_at, health, account_id, description, internal_notes"
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
    .select("id, project_id, account_id, budget_total, cost_to_date, billed_to_date, paid_to_date, currency, updated_at, created_at")
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

  const { data: companyRaw } = await supabase
    .from("companies")
    .select("id, name")
    .eq("account_id", accountId)
    .order("name", { ascending: true });

  const companyOptions: Option[] = ((companyRaw || []) as any[]).map((c) => ({
    id: c.id,
    label: c.name || c.id,
  }));

  return (
    <>
      <PageHeader
        title="Edit Project"
        subtitle="Update delivery, support, health, dates, owner, company, and financials."
      />
      <EditProjectForm
        initial={project as ProjectRow}
        initialFinancials={(financials as FinancialsRow) || null}
        ownerOptions={ownerOptions}
        opportunityOptions={opportunityOptions}
        companyOptions={companyOptions}
      />
    </>
  );
}