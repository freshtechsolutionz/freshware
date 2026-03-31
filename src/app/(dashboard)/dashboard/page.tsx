import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import CeoOverview from "@/components/dashboard/CeoOverview";
import AgentPanel from "@/components/dashboard/AgentPanel";
import ToLeaveList from "@/components/dashboard/ToLeaveList";

export const runtime = "nodejs";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  account_id: string | null;
};

type LeadProspect = {
  id: string;
  company_name: string | null;
  website: string | null;
  total_score: number | null;
  source_label: string | null;
  source_type: string | null;
  outreach_status: string | null;
  next_follow_up_at: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  discovered_emails: any;
  discovered_phones: any;
  outreach_subject: string | null;
  outreach_draft: string | null;
  created_at: string | null;
  converted_company_id: string | null;
  converted_opportunity_id: string | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

function money(n: number | null | undefined) {
  const value = Number(n || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function fmtDue(dueIso: string | null) {
  if (!dueIso) return "No due date";
  const d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString();
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function hasLeadContact(lead: LeadProspect) {
  return (
    Boolean(lead.contact_email) ||
    Boolean(lead.contact_phone) ||
    toArray(lead.discovered_emails).length > 0 ||
    toArray(lead.discovered_phones).length > 0
  );
}

function isFollowUpDue(value: string | null | undefined) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

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

  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = startOfYear(now);
  const thirtyDaysAgoIso = daysAgo(30).toISOString();
  const sevenDaysAgoIso = daysAgo(7).toISOString();
  const today = new Date();

  const [
    usersRes,
    tasksRes,
    oppRes,
    projectsRes,
    meetingsRes,
    ycbmRes,
    revenueRes,
    contactsRes,
    companiesRes,
    leadsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase
      .from("tasks")
      .select("task_id, status, due_at, created_at", { count: "exact" })
      .eq("account_id", accountId),

    supabase
      .from("opportunities")
      .select("id, amount, probability, stage, close_date, created_at")
      .eq("account_id", accountId)
      .is("deleted_at", null),

    supabase
      .from("projects")
      .select("id, status, health, due_date, created_at")
      .eq("account_id", accountId),

    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase.from("ycbm_bookings").select("id", { count: "exact", head: true }).eq("account_id", accountId),

    supabase
      .from("revenue_entries")
      .select("id, amount, recognized_on, entry_date, revenue_type, type, status, paid")
      .eq("account_id", accountId),

    supabase
      .from("contacts")
      .select("id, created_at")
      .eq("account_id", accountId),

    supabase
      .from("companies")
      .select("id, created_at")
      .eq("account_id", accountId),

    supabase
      .from("lead_prospects")
      .select(
        "id, company_name, website, total_score, source_label, source_type, outreach_status, next_follow_up_at, contact_email, contact_phone, discovered_emails, discovered_phones, outreach_subject, outreach_draft, created_at, converted_company_id, converted_opportunity_id"
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const totalUsers = usersRes.count ?? 0;
  const meetingsBooked = meetingsRes.count ?? 0;
  const ycbmBooked = ycbmRes.error ? 0 : (ycbmRes.count ?? 0);

  const taskRows = (tasksRes.data || []) as Array<{
    task_id: string;
    status: string | null;
    due_at: string | null;
    created_at: string | null;
  }>;

  const oppRows = (oppRes.data || []) as Array<{
    id: string;
    amount: number | null;
    probability: number | null;
    stage: string | null;
    close_date: string | null;
    created_at: string | null;
  }>;

  const projectRows = (projectsRes.data || []) as Array<{
    id: string;
    status: string | null;
    health: string | null;
    due_date: string | null;
    created_at: string | null;
  }>;

  const revenueRows = (revenueRes.data || []) as Array<{
    id: string;
    amount: number | null;
    recognized_on: string | null;
    entry_date: string | null;
    revenue_type: string | null;
    type: string | null;
    status: string | null;
    paid: boolean | null;
  }>;

  const contactRows = (contactsRes.data || []) as Array<{
    id: string;
    created_at: string | null;
  }>;

  const companyRows = (companiesRes.data || []) as Array<{
    id: string;
    created_at: string | null;
  }>;

  const leadRows = (leadsRes.data || []) as LeadProspect[];

  const totalTasks = tasksRes.count ?? taskRows.length ?? 0;
  const overdueTasks = taskRows.filter((t) => {
    if (!t.due_at) return false;
    const due = new Date(t.due_at);
    const status = String(t.status || "").toLowerCase();
    return due < now && status !== "done";
  }).length;

  const dueTodayTasks = taskRows.filter((t) => {
    if (!t.due_at) return false;
    const due = new Date(t.due_at);
    const status = String(t.status || "").toLowerCase();
    return isSameDay(due, today) && status !== "done";
  }).length;

  const completedThisWeek = taskRows.filter((t) => {
    const status = String(t.status || "").toLowerCase();
    if (status !== "done") return false;
    if (!t.created_at) return false;
    return new Date(t.created_at) >= new Date(sevenDaysAgoIso);
  }).length;

  const blockedTasks = taskRows.filter(
    (t) => String(t.status || "").toLowerCase() === "blocked"
  ).length;

  const openOppRows = oppRows.filter((r) => {
    const s = String(r.stage || "").toLowerCase();
    return s !== "won" && s !== "lost";
  });

  const wonOppRows = oppRows.filter((r) => {
    const s = String(r.stage || "").toLowerCase();
    return s === "won";
  });

  const openOppCount = openOppRows.length;
  const totalOppCount = oppRows.length;
  const openPipeline = openOppRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const weightedPipeline = openOppRows.reduce((sum, r) => {
    const amount = Number(r.amount) || 0;
    const probability = Number(r.probability) || 0;
    return sum + amount * (probability / 100);
  }, 0);

  const closingThisMonth = openOppRows.reduce((sum, r) => {
    if (!r.close_date) return sum;
    const d = new Date(r.close_date);
    return isSameMonth(d, now) ? sum + (Number(r.amount) || 0) : sum;
  }, 0);

  const closedWonThisMonth = wonOppRows.reduce((sum, r) => {
    if (!r.close_date) return sum;
    const d = new Date(r.close_date);
    return isSameMonth(d, now) ? sum + (Number(r.amount) || 0) : sum;
  }, 0);

  const activeProjects = projectRows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return !["done", "closed", "completed", "cancelled", "canceled"].includes(s);
  }).length;

  const totalProjects = projectRows.length;

  const atRiskProjects = projectRows.filter((r) => {
    const health = String(r.health || "").toLowerCase();
    return health === "red" || health === "yellow";
  }).length;

  const completedProjectsThisMonth = projectRows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    if (!["done", "completed", "closed"].includes(s)) return false;
    if (!r.created_at) return false;
    return isSameMonth(new Date(r.created_at), now);
  }).length;

  const normalizedRevenue = revenueRows.map((r) => {
    const dateStr = r.recognized_on || r.entry_date;
    const date = dateStr ? new Date(dateStr) : null;
    const amount = Number(r.amount) || 0;
    return { ...r, amount, date };
  });

  const revenueThisMonth = normalizedRevenue.reduce((sum, r) => {
    if (!r.date) return sum;
    return isSameMonth(r.date, now) ? sum + r.amount : sum;
  }, 0);

  const revenueLastMonth = normalizedRevenue.reduce((sum, r) => {
    if (!r.date) return sum;
    return isSameMonth(r.date, prevMonthStart) ? sum + r.amount : sum;
  }, 0);

  const revenueYtd = normalizedRevenue.reduce((sum, r) => {
    if (!r.date) return sum;
    return r.date >= yearStart ? sum + r.amount : sum;
  }, 0);

  const avgDealSize = normalizedRevenue.length
    ? normalizedRevenue.reduce((sum, r) => sum + r.amount, 0) / normalizedRevenue.length
    : 0;

  const newContacts30d = contactRows.filter((c) => {
    if (!c.created_at) return false;
    return new Date(c.created_at) >= new Date(thirtyDaysAgoIso);
  }).length;

  const newCompanies30d = companyRows.filter((c) => {
    if (!c.created_at) return false;
    return new Date(c.created_at) >= new Date(thirtyDaysAgoIso);
  }).length;

  const visitorsToday = visitors?.visitors_today ?? 0;
  const visitors7d = visitors?.visitors_7d ?? 0;
  const visitors30d = visitors?.visitors_30d ?? 0;

  const contactConversion30d =
    visitors30d > 0 ? (newContacts30d / visitors30d) * 100 : 0;

  const revenueTotal = normalizedRevenue.reduce((sum, r) => sum + r.amount, 0);

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

  const readyToEmail = leadRows
    .filter((lead) => {
      const hasContact = hasLeadContact(lead);
      const notContacted = String(lead.outreach_status || "NOT_CONTACTED") === "NOT_CONTACTED";
      const score = Number(lead.total_score || 0) >= 70;
      return hasContact && notContacted && score;
    })
    .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
    .slice(0, 5);

  const overdueFollowUps = leadRows
    .filter((lead) => isFollowUpDue(lead.next_follow_up_at))
    .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
    .slice(0, 5);

  const hotUncontacted = leadRows
    .filter((lead) => String(lead.outreach_status || "NOT_CONTACTED") === "NOT_CONTACTED")
    .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
    .slice(0, 5);

  const outreachReady = leadRows
    .filter((lead) => {
      const hasContact = hasLeadContact(lead);
      const hasDraft = Boolean(lead.outreach_subject) || Boolean(lead.outreach_draft);
      return hasContact && hasDraft;
    })
    .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
    .slice(0, 5);

  const executiveInsights: string[] = [];

  if (visitors30d > 0 && newContacts30d === 0) {
    executiveInsights.push(
      "Traffic is coming in, but 30-day lead capture is zero. Tighten your website conversion flow immediately."
    );
  }

  if (contactConversion30d > 0 && contactConversion30d < 2) {
    executiveInsights.push(
      `Visitor-to-lead conversion is only ${pct(contactConversion30d)} over 30 days. Marketing traffic is not converting strongly enough yet.`
    );
  }

  if (weightedPipeline > 0) {
    executiveInsights.push(
      `Weighted pipeline is ${money(weightedPipeline)}. That is the more realistic near-term revenue view than raw pipeline alone.`
    );
  }

  if (closingThisMonth > 0) {
    executiveInsights.push(
      `${money(closingThisMonth)} is currently scheduled to close this month. Push those deals hard before month-end.`
    );
  }

  if (atRiskProjects > 0) {
    executiveInsights.push(
      `${fmt(atRiskProjects)} project(s) are marked yellow/red. Delivery risk is creeping into the executive lane.`
    );
  }

  if (overdueTasks > 0) {
    executiveInsights.push(
      `${fmt(overdueTasks)} overdue task(s) need attention. Execution drag will eventually affect client trust and revenue.`
    );
  }

  if (readyToEmail.length > 0) {
    executiveInsights.push(
      `${fmt(readyToEmail.length)} lead(s) are contact-ready right now with contact info already found. Outreach can happen today.`
    );
  }

  if (overdueFollowUps.length > 0) {
    executiveInsights.push(
      `${fmt(overdueFollowUps.length)} follow-up(s) are already due. Revenue is likely sitting in the follow-up queue.`
    );
  }

  if (newCompanies30d > 0) {
    executiveInsights.push(
      `${fmt(newCompanies30d)} company profile(s) were added in the last 30 days. Use them to sharpen targeting and account intelligence.`
    );
  }

  if (!executiveInsights.length) {
    executiveInsights.push(
      "The business is showing healthy balance across traffic, sales, delivery, and execution. Keep pressure on consistency."
    );
  }

  const tools = [
    { label: "Meetings", href: "/dashboard/meetings" },
    { label: "Opportunities", href: "/dashboard/opportunities" },
    { label: "Contacts", href: "/dashboard/contacts" },
    { label: "Projects", href: "/dashboard/projects" },
    { label: "Tasks", href: "/dashboard/tasks" },
    { label: "Project Health", href: "/dashboard/reports/projects-health" },
    { label: "Company Profiles", href: "/dashboard/companies" },
    { label: "Lead Generator", href: "/dashboard/lead-generation" },
    { label: "Revenue", href: "/dashboard/revenue" },
  ];

  const adminTools = [
    { label: "Access Requests", href: "/admin/access-requests" },
    { label: "User Manager", href: "/admin/users" },
    { label: "System Health", href: "/dashboard/reports/analytics" },
  ];

  return (
    <div className="space-y-10">
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

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentPanel accountId={accountId} accountName={accountName} viewerId={profile.id} />

        <div className="fw-card-strong p-7">
          <div className="text-xl font-semibold tracking-tight text-gray-900">Command Center</div>
          <div className="mt-1 text-sm text-gray-600">
            Executive shortcuts for leadership focus, visibility, and action.
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CommandCard
              title="Weekly Executive Report"
              desc="Executive briefing with pipeline, delivery, task pressure, and lead momentum."
              href="/dashboard/reports/weekly"
            />
            <CommandCard
              title="Lead Generation"
              desc="Source, qualify, enrich, and move leads into pipeline."
              href="/dashboard/lead-generation"
            />
            <CommandCard
              title="Company Profiles"
              desc="Open company intelligence, linked records, and account context."
              href="/dashboard/companies"
            />
            <CommandCard
              title="Pipeline Drilldown"
              desc="Stages, totals, and top deals."
              href="/dashboard/reports/pipeline"
            />
            <CommandCard
              title="Overdue Tasks"
              desc="Clear blockers and overdue items fast."
              href="/dashboard/reports/overdue"
            />
            <CommandCard
              title="Project Health Heatmap"
              desc="Which projects are at risk right now."
              href="/dashboard/reports/projects-health"
            />
          </div>
        </div>
      </section>

      <ToLeaveList />

      <CeoOverview />

      <section className="fw-card-strong p-7">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-900">Executive Growth Dashboard</div>
            <div className="mt-1 text-sm text-gray-600">
              Traffic, lead conversion, pipeline, revenue, delivery risk, and execution in one view.
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Account scoped: <span className="font-semibold">{accountName}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/dashboard/reports/analytics" className="block">
            <MetricCard
              title="Website Visitors"
              value={visitors ? fmt(visitorsToday) : "—"}
              sub={visitors ? `7d: ${fmt(visitors7d)} · 30d: ${fmt(visitors30d)}` : "GA4 not connected"}
              note={visitors ? "Live GA4 active users." : "Connect GA4 to populate."}
            />
          </Link>

          <Link href="/dashboard/contacts" className="block">
            <MetricCard
              title="Lead Conversion"
              value={pct(contactConversion30d)}
              sub={`New leads 30d: ${fmt(newContacts30d)}`}
              note="Contacts created in Freshware ÷ 30-day visitors."
            />
          </Link>

          <Link href="/dashboard/opportunities" className="block">
            <MetricCard
              title="Weighted Pipeline"
              value={money(weightedPipeline)}
              sub={`Open pipeline: ${money(openPipeline)}`}
              note="Probability-adjusted forecast from opportunities."
            />
          </Link>

          <Link href="/dashboard/revenue" className="block">
            <MetricCard
              title="Revenue This Month"
              value={money(revenueThisMonth)}
              sub={`YTD: ${money(revenueYtd)}`}
              note="Recognized revenue based on revenue_entries."
            />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/dashboard/opportunities" className="block">
            <MetricCard
              title="Closing This Month"
              value={money(closingThisMonth)}
              sub={`Closed won: ${money(closedWonThisMonth)}`}
              note="Deals expected to close in the current month."
            />
          </Link>

          <Link href="/dashboard/projects" className="block">
            <MetricCard
              title="Project Health"
              value={fmt(atRiskProjects)}
              sub={`At risk · Active: ${fmt(activeProjects)}`}
              note="Projects currently flagged yellow or red."
            />
          </Link>

          <Link href="/dashboard/tasks" className="block">
            <MetricCard
              title="Execution Pressure"
              value={fmt(overdueTasks)}
              sub={`Due today: ${fmt(dueTodayTasks)}`}
              note="Overdue tasks and tasks due today."
            />
          </Link>

          <Link href="/dashboard/lead-generation" className="block">
            <MetricCard
              title="Lead Flow"
              value={fmt(leadRows.length)}
              sub={`Ready to email: ${fmt(readyToEmail.length)}`}
              note="Lead sourcing, contact discovery, and outreach readiness."
            />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-gray-900">Revenue Summary</div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span>This month</span>
                <span className="font-semibold text-gray-900">{money(revenueThisMonth)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Last month</span>
                <span className="font-semibold text-gray-900">{money(revenueLastMonth)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Year to date</span>
                <span className="font-semibold text-gray-900">{money(revenueYtd)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Average entry</span>
                <span className="font-semibold text-gray-900">{money(avgDealSize)}</span>
              </div>
            </div>
          </div>

          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-gray-900">Sales Summary</div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span>Open opportunities</span>
                <span className="font-semibold text-gray-900">{fmt(openOppCount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Total opportunities</span>
                <span className="font-semibold text-gray-900">{fmt(totalOppCount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Weighted pipeline</span>
                <span className="font-semibold text-gray-900">{money(weightedPipeline)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Meetings booked</span>
                <span className="font-semibold text-gray-900">{fmt(meetingsBooked)}</span>
              </div>
            </div>
          </div>

          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-gray-900">Execution Summary</div>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span>Total tasks</span>
                <span className="font-semibold text-gray-900">{fmt(totalTasks)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Blocked tasks</span>
                <span className="font-semibold text-gray-900">{fmt(blockedTasks)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Completed this week</span>
                <span className="font-semibold text-gray-900">{fmt(completedThisWeek)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Projects completed this month</span>
                <span className="font-semibold text-gray-900">{fmt(completedProjectsThisMonth)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-6">
          <div className="text-sm font-semibold text-gray-900">Executive Insights</div>
          <div className="mt-1 text-sm text-gray-600">
            Strategic highlights based on current Freshware and GA4 data.
          </div>

          <div className="mt-4 grid gap-3">
            {executiveInsights.map((insight, index) => (
              <div key={index} className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-gray-700">
                {insight}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fw-card-strong p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Outbound Command Center</div>
            <div className="mt-1 text-sm text-gray-600">
              The fastest route from lead intelligence to actual outreach activity.
            </div>
          </div>
          <Link href="/dashboard/lead-generation" className="fw-btn text-sm">
            Open Lead Generator
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <CommandList
            title="Ready to Email Today"
            subtitle="Has contact info, not yet contacted, and strong score."
            items={readyToEmail.map((lead) => ({
              id: lead.id,
              title: lead.company_name || "Unnamed Lead",
              meta: `${lead.source_label || lead.source_type || "Unknown source"} • Score ${lead.total_score ?? "N/A"}`,
              href: "/dashboard/lead-generation",
            }))}
          />

          <CommandList
            title="Overdue Follow-Ups"
            subtitle="These leads already need another touch."
            items={overdueFollowUps.map((lead) => ({
              id: lead.id,
              title: lead.company_name || "Unnamed Lead",
              meta: `Due ${fmtDue(lead.next_follow_up_at)} • Score ${lead.total_score ?? "N/A"}`,
              href: "/dashboard/lead-generation",
            }))}
          />

          <CommandList
            title="Hottest Uncontacted Leads"
            subtitle="High-scoring leads still untouched."
            items={hotUncontacted.map((lead) => ({
              id: lead.id,
              title: lead.company_name || "Unnamed Lead",
              meta: `${lead.source_label || lead.source_type || "Unknown source"} • Score ${lead.total_score ?? "N/A"}`,
              href: "/dashboard/lead-generation",
            }))}
          />

          <CommandList
            title="Outreach-Ready Drafts"
            subtitle="Lead already has contact info and a generated outreach message."
            items={outreachReady.map((lead) => ({
              id: lead.id,
              title: lead.company_name || "Unnamed Lead",
              meta: `${lead.outreach_subject || "Draft ready"} • Score ${lead.total_score ?? "N/A"}`,
              href: "/dashboard/lead-generation",
            }))}
          />
        </div>
      </section>

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

      <section className="fw-card-strong p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">My Assigned Tasks</div>
            <div className="mt-1 text-sm text-gray-600">
              Your current open tasks across opportunities and projects.
            </div>
          </div>
          <Link href="/dashboard/tasks" className="fw-btn text-sm">
            Open Tasks
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {myTodo.length ? (
            myTodo.map((task) => (
              <div key={task.task_id} className="fw-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {task.title || "Untitled task"}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Status: {task.status || "New"} · Due: {fmtDue(task.due_at)}
                    </div>
                  </div>
                  <span className="fw-chip">{task.status || "New"}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-600">You have no currently assigned open tasks.</div>
          )}
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

function CommandList(props: {
  title: string;
  subtitle: string;
  items: Array<{ id: string; title: string; meta: string; href: string }>;
}) {
  return (
    <div className="fw-card p-6">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.subtitle}</div>

      <div className="mt-4 space-y-3">
        {props.items.length ? (
          props.items.map((item) => (
            <Link key={item.id} href={item.href} className="block rounded-2xl border border-black/10 p-4 hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{item.title}</div>
              <div className="mt-1 text-xs text-gray-500">{item.meta}</div>
            </Link>
          ))
        ) : (
          <div className="text-sm text-gray-500">Nothing here right now.</div>
        )}
      </div>
    </div>
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