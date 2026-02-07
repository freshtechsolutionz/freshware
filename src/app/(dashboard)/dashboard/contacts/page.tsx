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
};

type AccountLite = { id: string; name: string | null };

export default async function ContactsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ✅ READ ONLY in Server Components
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth.user;

  if (authErr || !user) redirect("/portal?next=/dashboard/contacts");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;

  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,email,phone,account_id,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader
          title="Contacts"
          subtitle="People associated with accounts and opportunities."
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading contacts: {error.message}
        </div>
      </>
    );
  }

  const contacts = (data || []) as Contact[];

  const accountIds = Array.from(
    new Set(contacts.map((c) => c.account_id).filter(Boolean))
  ) as string[];

  const { data: accountsData } = accountIds.length
    ? await supabase.from("accounts").select("id,name").in("id", accountIds)
    : { data: [] as AccountLite[] };

  const accountsMap = Object.fromEntries(
    (accountsData || []).map((a) => [a.id, a])
  ) as Record<string, AccountLite>;

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="People associated with accounts and opportunities."
      />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <ContactsTable role={role} contacts={contacts} accountsMap={accountsMap} />
      </div>
    </>
  );
}
