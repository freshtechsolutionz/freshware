import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import EditCompanyForm from "@/components/companies/EditCompanyForm";

export const runtime = "nodejs";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/companies/${id}/edit`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Edit Company</div>
        <div className="mt-2 text-sm text-gray-600">Missing profile or account assignment.</div>
      </div>
    );
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Edit Company</div>
        <div className="mt-2 text-sm text-red-600">{error.message}</div>
      </div>
    );
  }

  if (!company) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Company"
        subtitle="Manage the company profile fields that power Company 360 and future lead intelligence."
      />
      <EditCompanyForm company={company} />
    </div>
  );
}