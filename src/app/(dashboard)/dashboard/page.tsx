import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import CeoOverview from "@/components/dashboard/CeoOverview";
import AgentPanel from "@/components/dashboard/AgentPanel";
import ToLeaveList from "@/components/dashboard/ToLeaveList";

export const runtime = "nodejs";

async function getVisitors(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/analytics/visitors`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json?.ok) return null;
    return json as {
      visitors_today: number;
      visitors_7d: number;
      visitors_30d: number;
    };
  } catch {
    return null;
  }
}
type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  account_id: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function fmtDue(dueIso: string | null) {
  if (!dueIso) return "No due date";
  const d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString();
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
      <div className="fw-card-strong p-7">
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
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold">Dashboard</div>
        <div className="mt-2 text-sm text-gray-600">
          Your profile is missing an account assignment. Ask an admin to set profiles.account_id.
        </div>
      </div>
    );
  }

  const accountId = profile.account_id;

  const { data: acct } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", accountId)
    .maybeSingle();
  const accountName = acct?.name || accountId;

    const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const visitors = await getVisitors(baseUrl);

  // Executive Overview metrics
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

  // ✅ MY TODO (assigned to me, across all projects)
  const { data: myTodoData } = await supabase
    .from("tasks")
    .select("task_id,title,status,due_at,opportunity_id")
    .eq("account_id", accountId)
    .eq("assigned_to", profile.id)
    .neq("status", "Done")
    .order("due_at", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(8);

  const myTodo = (myTodoData || []) as Array<{
    task_id: string;
    title: string | null;
    status: string | null;
    due_at: string | null;
    opportunity_id: string | null;
  }>;

  const tools = [
    { label: "Meetings", href: "/dashboard/meetings" },
    { label: "Opportunities", href: "/dashboard/opportunities" },
    { label: "Contacts", href: "/dashboard/contacts" },
    { label: "Projects", href: "/dashboard/projects" },
    { label: "Tasks", href: "/dashboard/tasks" },
    { label: "Project Heat Map", href: "/dashboard/project-heat-map" },
    { label: "Company Profiles", href: "/dashboard/companies" },
    { label: "Lead Generator", href: "/dashboard/lead-generator" },
    { label: "Revenue", href: "/dashboard/revenue" },
  ];

  const adminTools = [
    { label: "Access Requests", href: "/admin/access-requests" },
    { label: "User Manager", href: "/admin/users" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="fw-card-strong p-7">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-gray-900">Freshware Dashboard</div>
            <div className="mt-1 text-sm text-gray-600">
              Logged in as: <span className="font-semibold text-gray-900">{auth.user.email}</span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoPill label="Name" value={profile.full_name || "Unknown"} />
              <InfoPill label="Role" value={profile.role} />
              <InfoPill label="Account" value={accountName} />
              <InfoPill label="Access" value="Granted" good />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 lg:pt-0">
            <Link href="/" className="fw-btn text-sm">
              Portal entry
            </Link>
            {isAdmin ? (
              <Link href="/admin" className="fw-btn text-sm">
                Admin
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Agent LEFT + Command Center RIGHT */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentPanel accountId={accountId} accountName={accountName} viewerId={profile.id} />

        <div className="fw-card-strong p-7">
          <div className="text-xl font-semibold tracking-tight text-gray-900">Command Center</div>
          <div className="mt-1 text-sm text-gray-600">
            Your executive shortcuts. Everything here is clickable.
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CommandCard
              title="Weekly Executive Report"
              desc="Auto-generated leadership report for focus and priorities."
              href="/dashboard/reports/weekly"
            />
            <CommandCard
              title="Overdue Tasks"
              desc="Clear blockers and overdue items fast."
              href="/dashboard/reports/overdue"
            />
            <CommandCard
              title="Pipeline Drilldown"
              desc="Stages, totals, and top deals."
              href="/dashboard/reports/pipeline"
            />
            <CommandCard
              title="Project Health Heatmap"
              desc="Which projects are at risk right now."
              href="/dashboard/reports/projects-health"
            />
          </div>

          <div className="mt-5 text-xs text-gray-500">
            Next: profile collection system, real heatmap, and CEO brief notifications.
          </div>
        </div>
      </section>

<ToLeaveList />
 
      {/* CEO Overview */}
      <CeoOverview />

      {/* Tools */}
      <section className="fw-card-strong p-7">
        <div>
          <div className="text-lg font-semibold text-gray-900">Tools</div>
          <div className="mt-1 text-sm text-gray-600">Select a tool below to start working.</div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <ToolCard key={t.href} href={t.href} label={t.label} />
          ))}
        </div>

        {isAdmin ? (
          <div className="mt-9 border-t border-black/10 pt-7">
            <div className="text-sm font-semibold text-gray-900">Admin Panel</div>
            <div className="mt-1 text-sm text-gray-600">Approve users, assign roles, and manage accounts.</div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adminTools.map((t) => (
                <ToolCard key={t.href} href={t.href} label={t.label} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Executive Overview */}
      <section className="fw-card-strong p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Executive Overview</div>
            <div className="mt-1 text-sm text-gray-600">
              Live metrics (Freshware DB plus external sources when connected).
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Account scoped: <span className="font-semibold">{accountName}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/dashboard/reports/analytics" className="block">
            <MetricCard
              title="Site Visitors Today"
              value={visitors ? fmt(visitors.visitors_today) : "—"}
              sub={visitors ? `7 days: ${fmt(visitors.visitors_7d)}  30 days: ${fmt(visitors.visitors_30d)}` : "7 days: —  30 days: —"}
              note={visitors ? "GA4 activeUsers connected." : "GA4 not connected or env vars missing."}
            />
          </Link>

          <Link href="/dashboard/meetings" className="block">
            <MetricCard title="Meetings Booked" value={fmt(meetingsBooked)} sub={`YCBM: ${fmt(ycbmBooked)}`} note="Freshware meetings + optional YCBM." />
          </Link>

          <Link href="/dashboard/opportunities" className="block">
            <MetricCard title="Prospects Open" value={fmt(openOppCount)} sub={`Open pipeline: $${fmt(openPipeline)}`} note="Opportunities not won/lost." />
          </Link>

          <Link href="/dashboard/projects" className="block">
            <MetricCard title="Active Projects" value={fmt(activeProjects)} sub={`Total projects: ${fmt(totalProjects)}`} note="Status not done/closed/completed/cancelled." />
          </Link>

          <Link href="/dashboard/opportunities" className="block">
            <MetricCard title="Total Opportunities" value={fmt(totalOppCount)} sub="Open + won + lost" note="Account scoped." />
          </Link>

          <Link href="/dashboard/tasks" className="block">
            <MetricCard title="Total Tasks" value={fmt(totalTasks)} sub="All tasks in account" note="Account scoped." />
          </Link>

          <Link href="/admin/users" className="block">
            <MetricCard title="Total Users" value={fmt(totalUsers)} sub="Users in this account" note="Account scoped." />
          </Link>

          <Link href="/dashboard/revenue" className="block">
            <MetricCard
              title="Revenue"
              value={isAdmin ? (revenueTotal === null ? "—" : `$${fmt(revenueTotal)}`) : "Restricted"}
              sub={isAdmin ? "From revenue_entries" : "CEO/Admin only"}
              note={isAdmin ? "Connect revenue entries to dashboards." : "Only visible to CEO/Admin."}
            />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ToolCard(props: { href: string; label: string }) {
  return (
    <Link href={props.href} className="fw-card fw-interactive group block p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-900">{props.label}</div>
          <div className="mt-1 text-sm text-gray-600">Open</div>
        </div>
        <div className="fw-chip group-hover:bg-white">Go</div>
      </div>
    </Link>
  );
}

function CommandCard(props: { title: string; desc: string; href: string }) {
  return (
    <Link href={props.href} className="fw-card fw-interactive block p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{props.title}</div>
          <div className="mt-1 text-sm text-gray-600">{props.desc}</div>
        </div>
        <span className="fw-chip">Open</span>
      </div>
    </Link>
  );
}

function InfoPill(props: { label: string; value: string; good?: boolean }) {
  const base = "rounded-2xl border px-4 py-3";
  const bg = props.good ? "bg-green-50 border-green-200" : "bg-gray-50 border-black/10";
  return (
    <div className={`${base} ${bg}`}>
      <div className="text-xs font-semibold text-gray-700">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{props.value}</div>
    </div>
  );
}

function MetricCard(props: { title: string; value: string; sub: string; note: string }) {
  return (
    <div className="fw-card fw-interactive p-6">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{props.value}</div>
      <div className="mt-2 text-sm text-gray-600">{props.sub}</div>
      <div className="mt-3 text-xs text-gray-500">{props.note}</div>
    </div>
  );
}
