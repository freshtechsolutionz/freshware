import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import OpportunitiesClient from "@/app/opportunities/OpportunitiesClient";

export const runtime = "nodejs";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type UserLite = {
  id: string;
  full_name: string | null;
};

type AccountLite = {
  id: string;
  name: string | null;
  industry: string | null;
};

type ContactLite = {
  id: string;
  name: string | null;
  email: string | null;
  account_id: string;
};

type Opportunity = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  name: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  created_at: string;
  company_id?: string | null;
  last_touch_at?: string | null;
};

export default async function OpportunitiesPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/opportunities");

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError || !profileRow?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Opportunities</div>
        <div className="mt-2 text-sm text-gray-600">
          Missing profile or account assignment.
        </div>
      </div>
    );
  }

  const profile = profileRow as Profile;
  const accountId = profile.account_id;

  const [
    usersRes,
    accountsRes,
    contactsRes,
    oppsRes,
    activitiesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("account_id", accountId)
      .order("full_name", { ascending: true }),

    supabase
      .from("accounts")
      .select("id, name, industry")
      .eq("id", accountId)
      .limit(50),

    supabase
      .from("contacts")
      .select("id, name, email, account_id")
      .eq("account_id", accountId)
      .limit(500),

    supabase
      .from("opportunities")
      .select("id, account_id, contact_id, owner_user_id, name, service_line, stage, amount, probability, close_date, created_at")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("opportunity_activities")
      .select("opportunity_id, occurred_at")
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false }),
  ]);

  const lookupError =
    usersRes.error?.message ||
    accountsRes.error?.message ||
    contactsRes.error?.message ||
    null;

  const rowsError = oppsRes.error?.message || null;

  const oppRows = (oppsRes.data || []) as Opportunity[];
  const activityRows = (activitiesRes.data || []) as Array<{
    opportunity_id: string | null;
    occurred_at: string | null;
  }>;

  const latestActivityByOpp = new Map<string, string>();
  for (const row of activityRows) {
    const oppId = row.opportunity_id || "";
    const occurredAt = row.occurred_at || "";
    if (!oppId || !occurredAt) continue;
    if (!latestActivityByOpp.has(oppId)) {
      latestActivityByOpp.set(oppId, occurredAt);
    }
  }

  const rowsWithTouch = oppRows.map((row) => ({
    ...row,
    last_touch_at: latestActivityByOpp.get(row.id) || null,
  }));

  return (
    <div className="space-y-6 pb-10">
      <OpportunitiesClient
        profile={profile}
        users={(usersRes.data || []) as UserLite[]}
        initialAccounts={(accountsRes.data || []) as AccountLite[]}
        initialContacts={(contactsRes.data || []) as ContactLite[]}
        initialRows={rowsWithTouch}
        lookupError={lookupError}
        rowsError={rowsError}
      />
    </div>
  );
}