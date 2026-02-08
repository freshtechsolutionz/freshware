import PageHeader from "@/components/dashboard/PageHeader";
import EditAccountForm from "./EditAccountForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const runtime = "nodejs";

type Account = {
  id: string;
  name: string | null;
  industry: string | null;
  created_at: string | null;
};

export default async function EditAccountPage({
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
  if (!auth.user) redirect(`/portal?next=/dashboard/accounts/${id}`);

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,industry,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHeader
          title="Edit Account"
          subtitle="Update company information."
          right={
            <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
              Back to Accounts
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading account: {error.message}
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader
          title="Account not found"
          subtitle="This account may have been deleted."
          right={
            <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
              Back to Accounts
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          No record found for id: {id}
        </div>
      </>
    );
  }

  return <EditAccountForm initial={data as Account} />;
}
