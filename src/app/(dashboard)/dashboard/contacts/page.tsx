import PageHeader from "@/components/dashboard/PageHeader";
import ContactsTable from "@/components/ContactsTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  account_id: string | null;
  created_at: string | null;

  // new fields
  source?: string | null;
  imported_at?: string | null;
  last_seen_at?: string | null;
  owner_profile_id?: string | null;
};

type AccountLite = { id: string; name: string | null };
type OwnerLite = { id: string; full_name: string | null };

export default async function ContactsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return cookieStore.getAll(); } },
    }
  );

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth.user;
  if (authErr || !user) redirect("/portal?next=/dashboard/contacts");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;
  const accountId = profile?.account_id;

  if (!accountId) {
    return (
      <>
        <PageHeader title="Contacts" subtitle="People associated with accounts and opportunities." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Your profile is missing an account assignment (profiles.account_id).
        </div>
      </>
    );
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,email,phone,account_id,created_at,source,source_ref,imported_at,last_seen_at,owner_profile_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Contacts" subtitle="People associated with accounts and opportunities." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading contacts: {error.message}
        </div>
      </>
    );
  }

  const contacts = (data || []) as Contact[];

  // account name
  const { data: acct } = await supabase.from("accounts").select("id,name").eq("id", accountId).maybeSingle();
  const accountsMap: Record<string, AccountLite> = { [accountId]: (acct as any) ?? { id: accountId, name: accountId } };

  // owner lookup
  const ownerIds = Array.from(new Set(contacts.map(c => c.owner_profile_id).filter(Boolean))) as string[];
  const { data: ownersData } = ownerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds).eq("account_id", accountId)
    : { data: [] as OwnerLite[] };

  const ownersMap = Object.fromEntries((ownersData || []).map(o => [o.id, o])) as Record<string, OwnerLite>;

  return (
    <>
      <PageHeader title="Contacts" subtitle="People imported + created across Freshware." />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <ContactsTable role={role} contacts={contacts} accountsMap={accountsMap} ownersMap={ownersMap} />
      </div>
    </>
  );
}
