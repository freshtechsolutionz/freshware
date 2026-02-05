import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import OpportunitiesClient from "./OpportunitiesClient";

export default async function OpportunitiesPage() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/opportunities");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, account_id")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) redirect("/dashboard");

  const [accountsRes, contactsRes, oppsRes, usersRes, latestTouchRes] = await Promise.all([
    supabase.from("accounts").select("id, name, industry").order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, name, email, account_id").order("created_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select(
        "id, account_id, contact_id, owner_user_id, name, service_line, stage, amount, probability, close_date, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").order("full_name", { ascending: true }),
    supabase.from("opportunity_latest_touch").select("opportunity_id, last_touch_at"),
  ]);

  const latestByOpp: Record<string, string> = {};
  for (const row of latestTouchRes.data ?? []) {
    if (row?.opportunity_id && row?.last_touch_at) {
      latestByOpp[row.opportunity_id] = row.last_touch_at;
    }
  }

  const enrichedRows = (oppsRes.data ?? []).map((o: any) => ({
    ...o,
    last_touch_at: latestByOpp[o.id] ?? o.created_at,
  }));

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <Link
          href="/opportunities/new"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
        >
          + New Opportunity
        </Link>
      </div>

      <OpportunitiesClient
        profile={profile}
        users={usersRes.data ?? []}
        initialAccounts={accountsRes.data ?? []}
        initialContacts={contactsRes.data ?? []}
        initialRows={enrichedRows}
        lookupError={
          accountsRes.error?.message ??
          contactsRes.error?.message ??
          usersRes.error?.message ??
          latestTouchRes.error?.message ??
          null
        }
        rowsError={oppsRes.error?.message ?? null}
      />
    </main>
  );
}
