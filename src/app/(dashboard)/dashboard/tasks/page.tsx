import PageHeader from "@/components/dashboard/PageHeader";
import TasksTable from "@/components/TasksTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

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

  // 1️⃣ Load current user's profile (we need account_id)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profErr || !profile?.account_id) {
    return (
      <>
        <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Your profile is missing an account assignment.  
          Please contact an administrator.
        </div>
      </>
    );
  }

  const role = profile.role;
  const accountId = profile.account_id;

  // 2️⃣ Load ONLY tasks for this account
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "task_id,opportunity_id,title,description,due_at,status,assigned_to,created_by,created_at,updated_at,account_id"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

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

  const tasks = (data || []) as any[];

  // 3️⃣ Collect referenced IDs
  const oppIds = Array.from(new Set(tasks.map((t) => t.opportunity_id).filter(Boolean))) as string[];
  const userIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean))) as string[];

  // 4️⃣ Resolve opportunity names
  const oppMap: Record<string, string> = {};
  if (oppIds.length) {
    const { data: opps } = await supabase
      .from("opportunities")
      .select("id,name")
      .in("id", oppIds);

    for (const o of opps || []) {
      oppMap[o.id] = o.name || o.id;
    }
  }

  // 5️⃣ Resolve assignee names (same account only)
  const userMap: Record<string, { name: string; role: string | null }> = {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .in("id", userIds)
      .eq("account_id", accountId);

    for (const u of users || []) {
      userMap[u.id] = {
        name: u.full_name || u.id,
        role: u.role || null,
      };
    }
  }

  // 6️⃣ Build view model
  const view = tasks.map((t) => ({
    ...t,
    opportunity_name: t.opportunity_id ? oppMap[t.opportunity_id] || t.opportunity_id : null,
    assignee_name: t.assigned_to ? userMap[t.assigned_to]?.name || t.assigned_to : null,
    assignee_role: t.assigned_to ? userMap[t.assigned_to]?.role || null : null,
  }));

  return (
    <>
      <PageHeader title="Tasks" subtitle="Track follow-ups and next actions." />
      <div className="rounded-3xl border bg-background p-5 shadow-sm">
        <TasksTable role={role} tasks={view} />
      </div>
    </>
  );
}
