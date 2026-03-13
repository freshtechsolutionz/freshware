import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabaseServer } from "@/lib/supabase/server";
import OpportunityDetailClient from "@/components/OpportunityDetailClient";

export const runtime = "nodejs";

type Opportunity = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  last_activity_at: string | null;
  created_at: string | null;
  name: string | null;
  deleted_at?: string | null;
};

type Account = { id: string; name: string | null };
type Contact = { id: string; name: string | null; email: string | null };

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect(`/portal?next=/dashboard/opportunities/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;

  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .select(
      "id,account_id,contact_id,owner_user_id,service_line,stage,amount,probability,close_date,last_activity_at,created_at,name,deleted_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (oppErr) {
    return (
      <>
        <PageHeader title="Opportunity" subtitle="Details and next steps." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading opportunity: {oppErr.message}
        </div>
      </>
    );
  }

  if (!opp || (opp as any).deleted_at) notFound();

  const opportunity = opp as Opportunity;

  const { data: account } = opportunity.account_id
    ? await supabase
        .from("accounts")
        .select("id,name")
        .eq("id", opportunity.account_id)
        .maybeSingle()
    : { data: null as Account | null };

  const { data: contact } = opportunity.contact_id
    ? await supabase
        .from("contacts")
        .select("id,name,email")
        .eq("id", opportunity.contact_id)
        .maybeSingle()
    : { data: null as Contact | null };

  return (
    <>
      <PageHeader title="Opportunity" subtitle="Details, probability, and momentum." />
      <OpportunityDetailClient
        role={role}
        opportunity={opportunity as any}
        account={account || null}
        contact={contact || null}
      />
    </>
  );
}