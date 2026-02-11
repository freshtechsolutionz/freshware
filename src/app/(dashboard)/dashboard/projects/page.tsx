import PageHeader from "@/components/dashboard/PageHeader";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export default async function ProjectsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/projects");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return <div className="p-6">Missing account_id.</div>;
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Manage active and completed projects."
        right={
          <Link
            href="/dashboard/projects/new"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            + New Project
          </Link>
        }
      />

      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <div className="grid gap-4">
          {(projects || []).map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="rounded-2xl border p-4 hover:shadow-md transition"
            >
              <div className="text-lg font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground">
                Stage: {p.stage} • Status: {p.status}
              </div>
            </Link>
          ))}

          {(!projects || projects.length === 0) && (
            <div className="text-sm text-muted-foreground">
              No projects yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
