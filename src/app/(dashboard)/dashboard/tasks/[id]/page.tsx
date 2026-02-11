import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import EditTaskForm from "./EditTaskForm";

export const runtime = "nodejs";

async function findTaskById(supabase: any, id: string) {
  const a = await supabase.from("tasks").select("*").eq("task_id", id).maybeSingle();
  if (a.data) return a.data;

  const b = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (b.data) return b.data;

  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);

  return null;
}

export default async function TaskEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/tasks/${id}`);

  const { data: prof } = await supabase
    .from("profiles")
    .select("account_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const accountId = prof?.account_id;
  if (!accountId) {
    return (
      <>
        <PageHeader
          title="Edit Task"
          subtitle="Update task details."
          right={
            <Link href="/dashboard/tasks" className="rounded-lg border px-3 py-2 text-sm">
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

  try {
    const task = await findTaskById(supabase, id);

    if (!task) {
      return (
        <>
          <PageHeader
            title="Task not found"
            subtitle="This task may have been deleted."
            right={
              <Link href="/dashboard/tasks" className="rounded-lg border px-3 py-2 text-sm">
                Back to Tasks
              </Link>
            }
          />
          <div className="rounded-2xl border bg-background p-4 text-sm">
            No record found for id: {id}
          </div>
        </>
      );
    }

    const [oppRes, usersRes] = await Promise.all([
      supabase
        .from("opportunities")
        .select("id, name")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("account_id", accountId)
        .neq("role", "PENDING")
        .order("full_name", { ascending: true }),
    ]);

    const opportunities = (oppRes.data || []).map((o: any) => ({
      id: o.id,
      label: o.name || o.id,
    }));

    const users = (usersRes.data || []).map((u: any) => ({
      id: u.id,
      label: u.full_name || u.id,
    }));

    return <EditTaskForm initial={task} opportunities={opportunities} users={users} />;
  } catch (e: any) {
    return (
      <>
        <PageHeader
          title="Edit Task"
          subtitle="Update task details."
          right={
            <Link href="/dashboard/tasks" className="rounded-lg border px-3 py-2 text-sm">
              Back to Tasks
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading task: {e?.message || "Unknown error"}
        </div>
      </>
    );
  }
}
