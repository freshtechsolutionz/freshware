import PageHeader from "@/components/dashboard/PageHeader";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import ProjectKanban from "@/components/projects/ProjectKanban";

export const runtime = "nodejs";

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return <div className="p-6">Missing account_id.</div>;
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (!project) {
    return <div className="p-6">Project not found.</div>;
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("task_id,title,status")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`Stage: ${project.stage} • Status: ${project.status}`}
        right={
          <Link
            href="/dashboard/projects"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Back to Projects
          </Link>
        }
      />

      <div className="grid gap-6">

        {/* Project Overview */}
        <section className="rounded-2xl border p-6 shadow-sm bg-white">
          <div className="text-lg font-semibold mb-2">Project Overview</div>
          <div className="text-sm text-muted-foreground">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </div>
        </section>

        {/* Kanban Board */}
        <section className="rounded-2xl border p-6 shadow-sm bg-white">
          <div className="text-lg font-semibold mb-4">
            Tasks Board
          </div>

          <ProjectKanban
            projectId={project.id}
            tasks={(tasks || []).map((t) => ({
              task_id: t.task_id,
              title: t.title,
              status: t.status,
            }))}
          />
        </section>

      </div>
    </>
  );
}
