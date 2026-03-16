import PageHeader from "@/components/dashboard/PageHeader";
import AccountsTable from "@/components/AccountsTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Company = {
  id: string;
  name: string | null;
  legal_name: string | null;
  website: string | null;
  industry: string | null;
  customer_segment: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  created_at: string | null;
};

export default async function AccountsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/portal?next=/dashboard/accounts");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;
  if (!profile?.account_id) {
    return (
      <>
        <PageHeader title="Company Profiles" subtitle="Customer companies, intelligence, and relationship profiles." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Missing account_id on your profile.
        </div>
      </>
    );
  }

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id,name,legal_name,website,industry,customer_segment,lifecycle_stage,priority_level,city,state,status,created_at"
    )
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Company Profiles" subtitle="Customer companies, intelligence, and relationship profiles." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading companies: {error.message}
        </div>
      </>
    );
  }

  const companies = (data || []) as Company[];

  return (
    <>
      <PageHeader
        title="Company Profiles"
        subtitle="Track customer companies, decision makers, goals, risks, and linked work."
      />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <AccountsTable role={role} accounts={companies as any} />
      </div>
    </>
  );
}