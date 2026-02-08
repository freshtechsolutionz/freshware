import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import EditContactForm from "./EditContactForm";

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

export default async function EditContactPage({
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
      cookies: { getAll: () => cookieStore.getAll() },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/contacts/${id}`);

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id,name,email,phone,account_id,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHeader title="Edit Contact" subtitle="Update contact details." right={
          <Link href="/dashboard/contacts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Contacts
          </Link>
        }/>
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading contact: {error.message}
        </div>
      </>
    );
  }

  if (!contact) {
    return (
      <>
        <PageHeader title="Contact not found" subtitle="This contact may have been deleted." right={
          <Link href="/dashboard/contacts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Contacts
          </Link>
        }/>
        <div className="rounded-2xl border bg-background p-4 text-sm">
          No record found for id: {id}
        </div>
      </>
    );
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id,name")
    .order("created_at", { ascending: false });

  return (
    <EditContactForm
      initial={contact as Contact}
      accounts={(accounts || []) as AccountLite[]}
    />
  );
}
