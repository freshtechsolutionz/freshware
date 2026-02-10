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
    {
      cookies: { getAll: () => cookieStore.getAll() },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/tasks/new");

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
      <CreateTaskForm />
    </>
  );
}
