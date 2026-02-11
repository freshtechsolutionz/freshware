import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import CreateTaskForm from "./CreateTaskForm";

export const runtime = "nodejs";

export default async function NewTaskPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/tasks/new");

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("account_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profErr || !prof) {
    return (
      <>
        <PageHeader
          title="New Task"
          subtitle="Create a new task."
          right={
            <Link
              href="/dashboard/tasks"
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Back to Tasks
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Unable to load your profile.
        </div>
      </>
    );
  }

  const accountId = prof.account_id;
  if (!accountId) {
    return (
      <>
        <PageHeader
          title="New Task"
          subtitle="Create a new task."
          right={
            <Link
              href="/dashboard/tasks"
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Back to Tasks
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Your profile is missing an account assignment (profiles.account_id).
        </div>
      </>
    );
  }

  // Opportunities: support either name OR title (your schema varies across pages)
  const oppRes = await supabase
    .from("opportunities")
    .select("id, name")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  // Users: only users in the same account, not pending
  const usersRes = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("account_id", accountId)
    .neq("role", "PENDING")
    .order("full_name", { ascending: true });

  const opportunities =
    (oppRes.error ? [] : (oppRes.data || [])).map((o: any) => ({
      id: o.id,
      label: o.name || o.id,
    }));

  const users =
    (usersRes.error ? [] : (usersRes.data || [])).map((u: any) => ({
      id: u.id,
      label: u.full_name || u.id,
    }));

  return (
    <>
      <PageHeader
        title="New Task"
        subtitle="Create a new task."
        right={
          <Link
            href="/dashboard/tasks"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Back to Tasks
          </Link>
        }
      />

      <CreateTaskForm opportunities={opportunities} users={users} />
    </>
  );
}
