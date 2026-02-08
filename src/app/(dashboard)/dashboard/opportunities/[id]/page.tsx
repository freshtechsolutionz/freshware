import PageHeader from "@/components/dashboard/PageHeader";
import EditOpportunityForm from "./EditOpportunityForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const runtime = "nodejs";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
};

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/opportunities/${id}`);

  const { data, error } = await supabase
    .from("opportunities")
    .select("id,name,stage,service_line,amount")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHeader
          title="Edit Opportunity"
          subtitle="Update fields and keep your pipeline accurate."
          right={
            <Link
              href="/dashboard/opportunities"
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Back to Opportunities
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading opportunity: {error.message}
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader
          title="Opportunity not found"
          subtitle="This opportunity may have been deleted."
          right={
            <Link
              href="/dashboard/opportunities"
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Back to Opportunities
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          No record found for id: {id}
        </div>
      </>
    );
  }

  return <EditOpportunityForm initial={data as Opportunity} />;
}
