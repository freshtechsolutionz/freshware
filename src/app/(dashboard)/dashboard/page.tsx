import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import CeoOverview from "@/components/dashboard/CeoOverview";
import AgentPanel from "@/components/dashboard/AgentPanel";

export const runtime = "nodejs";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  account_id: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

export default async function DashboardHome() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard");

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profErr || !prof) {
    return (
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold">Dashboard</div>
        <div className="mt-2 text-sm text-gray-600">Unable to load your profile.</div>
      </div>
    );
  }

  const profile = prof as Profile;
  const roleUpper = (profile.role || "").toUpperCase();
  const isAdmin = roleUpper === "CEO" || roleUpper === "ADMIN";

  if (!profile.account_id) {
    return (
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold">Dashboard</div>
        <div className="mt-2 text-sm text-gray-600">
          Your profile is missing an account assignment. Ask an admin to set profiles.account_id.
        </div>
      </div>
    );
  }

  const accountId = profile.account_id;

  const { data: acct } = await supabase.from("accounts").select("name").eq("id", accountId).maybeSingle();
  const accountName = acct?.name || accountId;

  // Original Executive Overview metrics
  const [
    usersRes,
    tasksRes,
    oppOpenRes,
    oppAllRes,
    projectsActiveRes,
    projectsAllRes,
    meetingsRes,
    ycbmRes,
    revenueRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("tasks").select("task_id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase.from("opportunities").select("id, amount, stage", { count: "exact" }).eq("account_id", accountId),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase.from("projects").select("id,status", { count: "exact" }).eq("account_id", accountId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("ycbm_bookings").select("id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase.from("revenue_entries").select("amount", { count: "exact" }).eq("account_id", accountId),
  ]);

  const totalUsers = usersRes.count ?? 0;
  const totalTasks = tasksRes.count ?? 0;

  let openOppCount = 0;
  let openPipeline = 0;

  if (!oppOpenRes.error) {
    const rows = (oppOpenRes.data || []) as any[];
    const openRows = rows.filter((r) => {
      const s = String(r.stage || "").toLowerCase();
      return s !== "won" && s !== "lost";
    });
    openOppCount = openRows.length;
    openPipeline = openRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }

  const totalOppCount = oppAllRes.count ?? 0;

  let activeProjects = 0;
  if (!projectsActiveRes.error) {
    const rows = (projectsActiveRes.data || []) as any[];
    activeProjects = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return !["done", "closed", "completed", "cancelled"].includes(s);
    }).length;
  }
  const totalProjects = projectsAllRes.count ?? 0;

  const meetingsBooked = meetingsRes.count ?? 0;
  const ycbmBooked = ycbmRes.error ? 0 : (ycbmRes.count ?? 0);

  let revenueTotal: number | null = null;
  if (!revenueRes.error && isAdmin) {
    const rows = (revenueRes.data || []) as any[];
    revenueTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }

  const tools = [
    { label: "Sales Pipeline", href: "/dashboard/sales" },
    { label: "Opportunities", href: "/dashboard/opportunities" },
    { label: "Contacts", href: "/dashboard/contacts" },
    { label: "Meetings", href: "/dashboard/meetings" },
    { label: "Discovery Sessions", href: "/dashboard/discovery" },
    { label: "Proposals", href: "/dashboard/proposals" },
    { label: "Projects", href: "/dashboard/projects" },
    { label: "Tasks", href: "/dashboard/tasks" },
    { label: "Activities", href: "/dashboard/activities" },
  ];

  const adminTools = [
    { label: "Access Requests", href: "/admin/access-requests" },
    { label: "User Manager", href: "/admin/users" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-gray-900">Freshware Dashboard</div>
            <div className="mt-1 text-sm text-gray-600">
              Logged in as: <span className="font-semibold text-gray-900">{auth.user.email}</span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoPill label="Name" value={profile.full_name || "Unknown"} />
              <InfoPill label="Role" value={profile.role} />
              <InfoPill label="Account" value={accountName} />
              <InfoPill label="Access" value="Granted" good />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 lg:pt-0">
            <Link href="/" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
              Portal entry
            </Link>
            {isAdmin ? (
              <Link href="/admin" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Agent + Command Center (top priority) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentPanel accountId={accountId} accountName={accountName} viewerId={profile.id} />

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">CEO Command Center</div>
          <div className="mt-1 text-sm text-gray-600">Everything here is clickable. This is your daily operating system.</div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CommandCard title="Weekly CEO Report" desc="Auto-generated report for leadership focus." href="/dashboard#weekly-report" />
            <CommandCard title="Overdue Tasks" desc="Clear blockers and overdue items fast." href="/dashboard/reports/overdue" />
            <CommandCard title="Pipeline Drilldown" desc="Stages, totals, and top deals." href="/dashboard/reports/pipeline" />
            <CommandCard title="Project Health Heatmap" desc="Which projects are at risk right now." href="/dashboard/reports/projects-health" />
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Next: export to PDF, one-click investor summary, and CEO daily brief notifications.
          </div>
        </div>
      </section>

      {/* CEO Overview + charts (clickable) */}
      <CeoOverview />

      {/* Tools */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div>
          <div className="text-lg font-semibold text-gray-900">Tools</div>
          <div className="mt-1 text-sm text-gray-600">Select a tool below to start working.</div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <ToolCard key={t.href} href={t.href} label={t.label} />
          ))}
        </div>

        {isAdmin ? (
          <div className="mt-8 border-t pt-6">
            <div className="text-sm font-semibold text-gray-900">CEO Admin Panel</div>
            <div className="mt-1 text-sm text-gray-600">Approve users, assign roles, and manage accounts.</div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adminTools.map((t) => (
                <ToolCard key={t.href} href={t.href} label={t.label} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Executive Overview (your original section stays) */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Executive Overview</div>
            <div className="mt-1 text-sm text-gray-600">Live metrics (Freshware DB plus external sources when connected).</div>
          </div>
          <div className="text-xs text-gray-500">
            Account scoped: <span className="font-semibold">{accountName}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Site Visitors Today" value="—" sub="7 days: —  30 days: —" note="GA4 not connected in this build yet." />
          <MetricCard title="Meetings Booked" value={fmt(meetingsBooked)} sub={`YCBM: ${fmt(ycbmBooked)}`} note="Freshware meetings + optional YCBM." />
          <MetricCard title="Prospects Open" value={fmt(openOppCount)} sub={`Open pipeline: $${fmt(openPipeline)}`} note="Opportunities not won/lost." />
          <MetricCard title="Active Projects" value={fmt(activeProjects)} sub={`Total projects: ${fmt(totalProjects)}`} note="Status not done/closed/completed/cancelled." />
          <MetricCard title="Total Opportunities" value={fmt(totalOppCount)} sub="Open + won + lost" note="Account scoped." />
          <MetricCard title="Total Tasks" value={fmt(totalTasks)} sub="All tasks in account" note="Account scoped." />
          <MetricCard title="Total Users" value={fmt(totalUsers)} sub="Users in this account" note="Account scoped." />
          <MetricCard
            title="Revenue"
            value={isAdmin ? (revenueTotal === null ? "—" : `$${fmt(revenueTotal)}`) : "Restricted"}
            sub={isAdmin ? "From revenue_entries" : "CEO/Admin only"}
            note={isAdmin ? "Connect revenue entries to dashboards." : "Only visible to CEO/Admin."}
          />
        </div>
      </section>
    </div>
  );
}

function ToolCard(props: { href: string; label: string }) {
  return (
    <Link href={props.href} className="group rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900">{props.label}</div>
          <div className="mt-1 text-sm text-gray-600">Open</div>
        </div>
        <div className="rounded-2xl border px-3 py-2 text-sm font-semibold group-hover:bg-gray-50">Go</div>
      </div>
    </Link>
  );
}

function CommandCard(props: { title: string; desc: string; href: string }) {
  return (
    <Link href={props.href} className="rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.desc}</div>
      <div className="mt-4 inline-flex rounded-2xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50">
        Open
      </div>
    </Link>
  );
}

function InfoPill(props: { label: string; value: string; good?: boolean }) {
  const base = "rounded-2xl border px-4 py-3";
  const bg = props.good ? "bg-green-50 border-green-200" : "bg-gray-50";
  return (
    <div className={`${base} ${bg}`}>
      <div className="text-xs font-semibold text-gray-700">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{props.value}</div>
    </div>
  );
}

function MetricCard(props: { title: string; value: string; sub: string; note: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      <div className="mt-2 text-sm text-gray-600">{props.sub}</div>
      <div className="mt-3 text-xs text-gray-500">{props.note}</div>
    </div>
  );
}
