import PageHeader from "@/components/dashboard/PageHeader";
import OpportunitiesTable from "@/components/OpportunitiesTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  last_activity_at: string | null;
  created_at: string | null;
};

type Account = { id: string; name: string | null };
type Contact = { id: string; name: string | null; email: string | null };

export const runtime = "nodejs";

export default async function OpportunitiesPage() {
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
  if (!user) redirect("/portal?next=/dashboard/opportunities");

  // Role (adjust table/column names if yours differ)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;

  const { data: opportunitiesData, error: oppErr } = await supabase
    .from("opportunities")
    .select(
      "id,name,stage,service_line,amount,probability,close_date,account_id,contact_id,owner_user_id,last_activity_at,created_at"
    )
    .order("created_at", { ascending: false });

  if (oppErr) {
    return (
      <>
        <PageHeader title="Opportunities" subtitle="Track pipeline, activity, and next steps." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading opportunities: {oppErr.message}
        </div>
      </>
    );
  }

  const opportunities = (opportunitiesData || []) as Opportunity[];

  const accountIds = Array.from(
    new Set(opportunities.map((o) => o.account_id).filter(Boolean))
  ) as string[];

  const contactIds = Array.from(
    new Set(opportunities.map((o) => o.contact_id).filter(Boolean))
  ) as string[];

  const { data: accountsData } = accountIds.length
    ? await supabase.from("accounts").select("id,name").in("id", accountIds)
    : { data: [] as Account[] };

  const { data: contactsData } = contactIds.length
    ? await supabase.from("contacts").select("id,name,email").in("id", contactIds)
    : { data: [] as Contact[] };

  const accountsMap = Object.fromEntries(
    (accountsData || []).map((a) => [a.id, a])
  ) as Record<string, Account>;

  const contactsMap = Object.fromEntries(
    (contactsData || []).map((c) => [c.id, c])
  ) as Record<string, Contact>;

  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle="Track pipeline, activity, and next steps."
      />

      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <OpportunitiesTable
          role={role}
          opportunities={opportunities}
          accountsMap={accountsMap}
          contactsMap={contactsMap}
        />
      </div>
    </>
  );
}
