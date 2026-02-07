import PageHeader from "@/components/dashboard/PageHeader";
import AccountsTable from "@/components/AccountsTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Account = {
  id: string;
  name: string | null;
  industry: string | null;
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,industry,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Accounts" subtitle="Companies and organizations in your CRM." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading accounts: {error.message}
        </div>
      </>
    );
  }

  const accounts = (data || []) as Account[];

  return (
    <>
      <PageHeader title="Accounts" subtitle="Companies and organizations in your CRM." />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <AccountsTable role={role} accounts={accounts} />
      </div>
    </>
  );
}
