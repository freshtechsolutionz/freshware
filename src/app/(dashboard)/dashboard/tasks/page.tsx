import PageHeader from "@/components/dashboard/PageHeader";
import TasksTable from "@/components/TasksTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Task = {
  task_id: string;
  opportunity_id: string | null;
  title: string | null;
  // Add more fields later if your table has them (status, due_at, assigned_to, etc.)
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;

  const { data, error } = await supabase
    .from("tasks")
    .select("task_id,opportunity_id,title")
    .order("task_id", { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading tasks: {error.message}
        </div>
      </>
    );
  }

  const tasks = (data || []) as Task[];

  return (
    <>
      <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <TasksTable role={role} tasks={tasks} />
      </div>
    </>
  );
}
