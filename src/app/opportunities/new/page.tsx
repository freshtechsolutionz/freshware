import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import OpportunityForm from "@/components/OpportunityForm";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type Account = { id: string; name: string | null };
type Contact = { id: string; name: string | null; email: string | null; account_id: string };

export default async function NewOpportunityPage() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/opportunities/new");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, account_id")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/opportunities");

  const role = profile.role ?? "PENDING";
  const canCreate = ["CEO", "ADMIN", "SALES", "OPS"].includes(role);

  if (!canCreate) redirect("/opportunities");

  const [accountsRes, contactsRes] = await Promise.all([
    supabase.from("accounts").select("id, name").order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, name, email, account_id").order("created_at", { ascending: false }),
  ]);

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">New Opportunity</h1>

      <OpportunityForm
        mode="create"
        initial={null}
        accounts={(accountsRes.data ?? []) as Account[]}
        contacts={(contactsRes.data ?? []) as Contact[]}
        afterSaveHref="/opportunities"
      />
    </main>
  );
}
