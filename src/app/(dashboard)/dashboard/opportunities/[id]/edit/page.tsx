import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabaseServer } from "@/lib/supabase/server";
import EditOpportunityForm from "../EditOpportunityForm";

export const runtime = "nodejs";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  probability: number | null;
  last_activity_at: string | null;
  created_at: string | null;
  deleted_at?: string | null;
};

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect(`/portal?next=/dashboard/opportunities/${id}/edit`);

  const { data: opp, error } = await supabase
    .from("opportunities")
    .select(
      "id,name,stage,service_line,amount,probability,last_activity_at,created_at,deleted_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHeader title="Edit Opportunity" subtitle="Update opportunity details." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading opportunity: {error.message}
        </div>
      </>
    );
  }

  if (!opp || (opp as any).deleted_at) notFound();

  return <EditOpportunityForm initial={opp as Opportunity} />;
}