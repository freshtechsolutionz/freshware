import PageHeader from "@/components/dashboard/PageHeader";
import TasksTable from "@/components/TasksTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type TaskStatus = "New" | "In Progress" | "Done" | "Blocked";

type TaskRow = {
  task_id: string;
  title: string | null;
  description: string | null;
  status: TaskStatus;
  due_at: string | null;
  opportunity_id: string | null;
  assigned_to: string | null;
  opportunity_name?: string | null;
  assignee_name?: string | null;
};

export default async function TasksPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/tasks");

  const viewerId = auth.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_id")
    .eq("id", viewerId)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;
  const accountId = profile?.account_id;

  if (!accountId) {
    return (
      <>
        <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Your profile is missing an account assignment (profiles.account_id).
        </div>
      </>
    );
  }

  const { data: tasksData, error: tasksErr } = await supabase
    .from("tasks")
    .select("task_id,title,description,status,due_at,opportunity_id,assigned_to")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (tasksErr) {
    return (
      <>
        <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading tasks: {tasksErr.message}
        </div>
      </>
    );
  }

  const tasks = (tasksData || []) as TaskRow[];

  const oppIds = Array.from(new Set(tasks.map((t) => t.opportunity_id).filter(Boolean))) as string[];
  const userIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean))) as string[];

  const [oppRes, usersRes] = await Promise.all([
    oppIds.length
      ? supabase.from("opportunities").select("id, name").in("id", oppIds).eq("account_id", accountId)
      : Promise.resolve({ data: [], error: null } as any),
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds).eq("account_id", accountId)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const oppMap: Record<string, string> = {};
  if (!oppRes.error) {
    for (const o of (oppRes.data || []) as any[]) {
      oppMap[o.id] = o.name || o.id;
    }
  }

  const userMap: Record<string, string> = {};
  if (!usersRes.error) {
    for (const u of (usersRes.data || []) as any[]) {
      userMap[u.id] = u.full_name || u.id;
    }
  }

  const hydrated = tasks.map((t) => ({
    ...t,
    opportunity_name: t.opportunity_id ? oppMap[t.opportunity_id] || null : null,
    assignee_name: t.assigned_to ? userMap[t.assigned_to] || null : null,
  }));

  return (
    <>
      <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <TasksTable role={role} viewerId={viewerId} tasks={hydrated} />
      </div>
    </>
  );
}
