import { notFound, redirect } from "next/navigation";
import OpportunityForm from "@/components/OpportunityForm";
import { supabaseServer } from "@/lib/supabase/server";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OpportunityPage({ params }: PageProps) {
  // ✅ Next.js (your setup) provides params as a Promise
  const { id } = await params;

  // 🚨 Safety: invalid or missing id
  if (!id || !uuidRegex.test(id)) {
    notFound();
  }

  const supabase = await supabaseServer();

  // 🔐 Auth check
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect(`/login?next=/opportunities/${id}`);
  }

  // 🔐 Profile check (kept simple for now)
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    redirect("/dashboard");
  }

  // Fetch needed data in parallel
  const [oppRes, accountsRes, contactsRes] = await Promise.all([
    supabase.from("opportunities").select("*").eq("id", id).single(),
    supabase.from("accounts").select("id,name").order("name", { ascending: true }),
    supabase
      .from("contacts")
      .select("id,name,email,account_id")
      .order("name", { ascending: true }),
  ]);

  // (Optional debug if you still need it)
  // console.log("oppErr:", oppRes.error);
  // console.log("oppData:", oppRes.data);

  const opportunity = oppRes.data;

  if (oppRes.error || !opportunity) {
    notFound();
  }

  const accounts = accountsRes.data ?? [];
  const contacts = contactsRes.data ?? [];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Opportunity Details</h1>

      <OpportunityForm
        mode="edit"
        initial={opportunity}
        accounts={accounts}
        contacts={contacts}
        afterSaveHref="/opportunities"
      />
    </div>
  );
}
