import PageHeader from "@/components/dashboard/PageHeader";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

function pretty(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function daysTo(due: string | null | undefined) {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function chipClass(health: string | null | undefined) {
  const h = String(health || "").toUpperCase();
  if (h === "GREEN") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (h === "YELLOW") return "bg-amber-100 text-amber-800 border-amber-200";
  if (h === "RED") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

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

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, stage, status, opportunity_id, created_at, account_id, health, due_date, start_date")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false });

  const rows = (projects || []) as any[];

  const activeCount = rows.filter((p) => String(p.status || "").toLowerCase() === "active").length;
  const redCount = rows.filter((p) => String(p.health || "").toUpperCase() === "RED").length;
  const dueSoonCount = rows.filter((p) => {
    const d = daysTo(p.due_date);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const linkedCount = rows.filter((p) => !!p.opportunity_id).length;

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="CEO view of delivery, deadlines, and health across your portfolio."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/reports/projects-health"
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Open Heat Map
            </Link>
            <Link
              href="/dashboard/projects/new"
              className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              + New Project
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Total Projects</div>
          <div className="mt-2 text-2xl font-semibold">{rows.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Red Health</div>
          <div className="mt-2 text-2xl font-semibold">{redCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Due in 7 Days</div>
          <div className="mt-2 text-2xl font-semibold">{dueSoonCount}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-background p-6 shadow-sm">
        {error ? (
          <div className="text-sm text-red-600">Error loading projects: {error.message}</div>
        ) : (
          <div className="grid gap-4">
            {rows.map((p) => {
              const d = daysTo(p.due_date);
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="rounded-2xl border p-5 hover:shadow-md transition bg-white"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{p.name || "Untitled Project"}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Stage: {pretty(p.stage)} • Status: {pretty(p.status)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Start: {p.start_date || "—"} • Due: {p.due_date || "—"}
                      </div>
                      {p.opportunity_id ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Linked opportunity: {p.opportunity_id}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClass(p.health)}`}>
                        {pretty(p.health)}
                      </span>
                      {d !== null ? (
                        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                          {d < 0 ? `${Math.abs(d)} days overdue` : `${d} days left`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}

            {rows.length === 0 && (
              <div className="text-sm text-muted-foreground">No projects yet.</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold">Portfolio Signal</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {linkedCount} of {rows.length} projects are linked to opportunities. That linkage is the foundation for better revenue forecasting and customer pattern analysis.
        </div>
      </div>
    </>
  );
}