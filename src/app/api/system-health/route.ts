import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string | null;
};

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
  website: string | null;
  industry: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type LeadRow = {
  id: string;
  company_name: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  next_follow_up_at: string | null;
  outreach_status: string | null;
  total_score: number | null;
  website_analyzed_at: string | null;
};

type OpportunityRow = {
  id: string;
  name: string | null;
  stage: string | null;
  close_date: string | null;
  company_id: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  last_activity_at: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  status: string | null;
  company_id: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TaskRow = {
  task_id: string;
  title: string | null;
  status: string | null;
  due_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ActivityRow = {
  opportunity_id: string | null;
  occurred_at: string | null;
};

type MeetingRow = {
  id: string;
  created_at: string | null;
};

type OutreachEventRow = {
  lead_id: string | null;
  delivery_status: string | null;
  created_at: string | null;
};

type YcbmRow = {
  id: string;
  created_at: string | null;
};

function isAdminish(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function normalizeName(v: string | null | undefined) {
  return String(v || "").trim().toLowerCase();
}

function normalizeEmail(v: string | null | undefined) {
  return String(v || "").trim().toLowerCase();
}

function daysSince(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function statusForRatio(value: number, goodMax: number, warnMax: number) {
  if (value <= goodMax) return "green";
  if (value <= warnMax) return "yellow";
  return "red";
}

function statusForCount(value: number, goodMax: number, warnMax: number) {
  if (value <= goodMax) return "green";
  if (value <= warnMax) return "yellow";
  return "red";
}

function pct(num: number, denom: number) {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

function latestDate(values: Array<string | null | undefined>) {
  const valid = values
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((v) => !Number.isNaN(v));
  if (!valid.length) return null;
  return new Date(Math.max(...valid)).toISOString();
}

export async function GET() {
  try {
    const { supabase, user, profile } = await requireViewer();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!profile?.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
    if (!isAdminish(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const accountId = profile.account_id;
    const nowIso = new Date().toISOString();
    const staleCutoff = new Date();
    staleCutoff.setMonth(staleCutoff.getMonth() - 6);
    const staleIso = staleCutoff.toISOString();

    const [
      profilesRes,
      contactsRes,
      companiesRes,
      leadsRes,
      oppsRes,
      projectsRes,
      tasksRes,
      activitiesRes,
      meetingsRes,
      outreachRes,
      ycbmRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, created_at")
        .eq("account_id", accountId),

      supabase
        .from("contacts")
        .select("id, name, email, phone, company_id, created_at, updated_at")
        .eq("account_id", accountId),

      supabase
        .from("companies")
        .select("id, name, website, industry, created_at, updated_at")
        .eq("account_id", accountId),

      supabase
        .from("lead_prospects")
        .select("id, company_name, website, contact_email, contact_phone, created_at, updated_at, created_by, next_follow_up_at, outreach_status, total_score, website_analyzed_at")
        .eq("account_id", accountId),

      supabase
        .from("opportunities")
        .select("id, name, stage, close_date, company_id, owner_user_id, created_at, last_activity_at")
        .eq("account_id", accountId)
        .is("deleted_at", null),

      supabase
        .from("projects")
        .select("id, name, status, company_id, owner_user_id, created_at, updated_at")
        .eq("account_id", accountId),

      supabase
        .from("tasks")
        .select("task_id, title, status, due_at, assigned_to, created_by, created_at, updated_at")
        .eq("account_id", accountId),

      supabase
        .from("opportunity_activities")
        .select("opportunity_id, occurred_at")
        .eq("account_id", accountId),

      supabase
        .from("meetings")
        .select("id, created_at")
        .eq("account_id", accountId),

      supabase
        .from("lead_outreach_events")
        .select("lead_id, delivery_status, created_at")
        .eq("account_id", accountId),

      supabase
        .from("ycbm_bookings")
        .select("id, created_at")
        .eq("account_id", accountId),
    ]);

    const profiles = (profilesRes.data || []) as ProfileRow[];
    const contacts = (contactsRes.data || []) as ContactRow[];
    const companies = (companiesRes.data || []) as CompanyRow[];
    const leads = (leadsRes.data || []) as LeadRow[];
    const opps = (oppsRes.data || []) as OpportunityRow[];
    const projects = (projectsRes.data || []) as ProjectRow[];
    const tasks = (tasksRes.data || []) as TaskRow[];
    const activities = (activitiesRes.data || []) as ActivityRow[];
    const meetings = (meetingsRes.data || []) as MeetingRow[];
    const outreachEvents = (outreachRes.data || []) as OutreachEventRow[];
    const ycbm = (ycbmRes.data || []) as YcbmRow[];

    const companyNameCounts = new Map<string, number>();
    for (const c of companies) {
      const key = normalizeName(c.name);
      if (!key) continue;
      companyNameCounts.set(key, (companyNameCounts.get(key) || 0) + 1);
    }
    const duplicateCompanies = Array.from(companyNameCounts.values()).filter((x) => x > 1).reduce((a, b) => a + b, 0);

    const contactEmailCounts = new Map<string, number>();
    for (const c of contacts) {
      const key = normalizeEmail(c.email);
      if (!key) continue;
      contactEmailCounts.set(key, (contactEmailCounts.get(key) || 0) + 1);
    }
    const duplicateContacts = Array.from(contactEmailCounts.values()).filter((x) => x > 1).reduce((a, b) => a + b, 0);

    const leadWebsiteCounts = new Map<string, number>();
    for (const l of leads) {
      const key = normalizeName(l.website);
      if (!key) continue;
      leadWebsiteCounts.set(key, (leadWebsiteCounts.get(key) || 0) + 1);
    }
    const duplicateLeads = Array.from(leadWebsiteCounts.values()).filter((x) => x > 1).reduce((a, b) => a + b, 0);

    const missingCritical = {
      contactsMissingEmail: contacts.filter((c) => !normalizeEmail(c.email)).length,
      contactsMissingPhone: contacts.filter((c) => !String(c.phone || "").trim()).length,
      companiesMissingIndustry: companies.filter((c) => !String(c.industry || "").trim()).length,
      companiesMissingWebsite: companies.filter((c) => !String(c.website || "").trim()).length,
      leadsMissingWebsiteAndEmail: leads.filter((l) => !String(l.website || "").trim() && !normalizeEmail(l.contact_email)).length,
    };

    const staleContacts = contacts.filter((c) => String(c.updated_at || c.created_at || "") < staleIso).length;
    const staleCompanies = companies.filter((c) => String(c.updated_at || c.created_at || "") < staleIso).length;
    const staleLeads = leads.filter((l) => String(l.updated_at || l.created_at || "") < staleIso).length;

    const contactsWithoutCompany = contacts.filter((c) => !c.company_id).length;
    const companiesWithoutContacts = companies.filter(
      (company) => !contacts.some((contact) => contact.company_id === company.id)
    ).length;

    const dataQuality = [
      {
        key: "duplicate_records",
        label: "Duplicate Records",
        value: duplicateCompanies + duplicateContacts + duplicateLeads,
        meta: `${duplicateContacts} contacts · ${duplicateCompanies} companies · ${duplicateLeads} leads`,
        status: statusForCount(duplicateCompanies + duplicateContacts + duplicateLeads, 0, 10),
        action: "Review duplicate names/emails and merge where needed.",
      },
      {
        key: "missing_critical_fields",
        label: "Missing Critical Fields",
        value:
          missingCritical.contactsMissingEmail +
          missingCritical.contactsMissingPhone +
          missingCritical.companiesMissingIndustry +
          missingCritical.companiesMissingWebsite +
          missingCritical.leadsMissingWebsiteAndEmail,
        meta:
          `${missingCritical.contactsMissingEmail} contact emails · ` +
          `${missingCritical.companiesMissingIndustry} company industries · ` +
          `${missingCritical.companiesMissingWebsite} company websites`,
        status: statusForCount(
          missingCritical.contactsMissingEmail +
            missingCritical.contactsMissingPhone +
            missingCritical.companiesMissingIndustry +
            missingCritical.companiesMissingWebsite +
            missingCritical.leadsMissingWebsiteAndEmail,
          5,
          20
        ),
        action: "Run cleanup on missing email, website, and industry fields.",
      },
      {
        key: "stale_data",
        label: "Stale Data",
        value: staleContacts + staleCompanies + staleLeads,
        meta: `${staleContacts} contacts · ${staleCompanies} companies · ${staleLeads} leads older than 6 months`,
        status: statusForCount(staleContacts + staleCompanies + staleLeads, 20, 60),
        action: "Refresh or archive records untouched in the last 6–12 months.",
      },
      {
        key: "linkage",
        label: "Contact / Company Linkage",
        value: contactsWithoutCompany + companiesWithoutContacts,
        meta: `${contactsWithoutCompany} contacts unlinked · ${companiesWithoutContacts} companies without contacts`,
        status: statusForCount(contactsWithoutCompany + companiesWithoutContacts, 5, 20),
        action: "Use company linking tools to connect people and accounts.",
      },
    ];

    const userLastActive = profiles.map((p) => {
      const lastActiveAt = latestDate([
        ...tasks
          .filter((t) => t.assigned_to === p.id || t.created_by === p.id)
          .flatMap((t) => [t.updated_at, t.created_at]),
        ...leads.filter((l) => l.created_by === p.id).map((l) => l.updated_at || l.created_at),
        ...opps.filter((o) => o.owner_user_id === p.id).flatMap((o) => [o.last_activity_at, o.created_at]),
        ...projects.filter((pr) => pr.owner_user_id === p.id).flatMap((pr) => [pr.updated_at, pr.created_at]),
      ]);

      const days = daysSince(lastActiveAt);
      return {
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        lastActiveAt,
        daysAgo: days,
      };
    });

    const active7 = userLastActive.filter((u) => u.daysAgo != null && u.daysAgo <= 7).length;
    const active30 = userLastActive.filter((u) => u.daysAgo != null && u.daysAgo <= 30).length;
    const neverActive = userLastActive.filter((u) => !u.lastActiveAt).length;

    const createdLast30ByUser = profiles.map((p) => {
      const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
      const leadsCreated = leads.filter((l) => {
        const created = l.created_at ? new Date(l.created_at).getTime() : 0;
        return l.created_by === p.id && created >= cutoff;
      }).length;
      const tasksCreated = tasks.filter((t) => {
        const created = t.created_at ? new Date(t.created_at).getTime() : 0;
        return t.created_by === p.id && created >= cutoff;
      }).length;
      const oppOwned = opps.filter((o) => {
        const created = o.created_at ? new Date(o.created_at).getTime() : 0;
        return o.owner_user_id === p.id && created >= cutoff;
      }).length;
      return {
        userId: p.id,
        name: p.full_name || "Unnamed User",
        role: p.role || "Unknown",
        total: leadsCreated + tasksCreated + oppOwned,
      };
    });

    const completedTasks = tasks.filter((t) => String(t.status || "").toLowerCase() === "done").length;
    const scheduledTasks = tasks.length;
    const opportunitiesWithoutActivity = opps.filter(
      (opp) => !activities.some((a) => a.opportunity_id === opp.id)
    ).length;

    const moduleUsage = [
      { name: "Lead Generation", count: leads.length },
      { name: "Website Analysis", count: leads.filter((l) => l.website_analyzed_at).length },
      { name: "Opportunities", count: opps.length },
      { name: "Tasks", count: tasks.length },
      { name: "Meetings", count: meetings.length },
      { name: "Company Profiles", count: companies.length },
      { name: "YCBM Sync", count: ycbm.length },
    ].sort((a, b) => b.count - a.count);

    const adoption = {
      active7,
      active30,
      neverActive,
      completedTasks,
      scheduledTasks,
      taskCompletionRate: pct(completedTasks, scheduledTasks),
      missingActivityNotes: opportunitiesWithoutActivity,
      lastActiveByUser: userLastActive.sort((a, b) => {
        const av = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bv = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bv - av;
      }),
      creationByUser: createdLast30ByUser.sort((a, b) => b.total - a.total),
      moduleUsage,
    };

    const pendingApprovals = profiles.filter((p) => String(p.role || "").toUpperCase() === "PENDING").length;
    const neglectedOpps = opps.filter((o) => {
      const d = daysSince(o.last_activity_at || o.created_at);
      return d != null && d >= 60;
    }).length;
    const staleDeals = opps.filter((o) => {
      const stage = String(o.stage || "").toLowerCase();
      if (stage === "won" || stage === "lost") return false;
      if (!o.close_date) return true;
      const close = new Date(o.close_date);
      return !Number.isNaN(close.getTime()) && close.getTime() < Date.now();
    }).length;
    const overdueTasks = tasks.filter((t) => {
      if (!t.due_at) return false;
      const due = new Date(t.due_at);
      return !Number.isNaN(due.getTime()) && due.getTime() < Date.now() && String(t.status || "").toLowerCase() !== "done";
    }).length;

    const workflow = [
      {
        key: "pending_approvals",
        label: "Pending Approval Tasks",
        value: pendingApprovals,
        meta: "Users still in PENDING role",
        status: statusForCount(pendingApprovals, 0, 5),
        action: "Review and approve or deny pending users.",
      },
      {
        key: "neglected_opps",
        label: "Neglected Opportunities / Leads",
        value: neglectedOpps,
        meta: "60+ days without movement",
        status: statusForCount(neglectedOpps, 3, 10),
        action: "Assign next action and push stale opportunities forward.",
      },
      {
        key: "stale_deals",
        label: "Stale Deals / No Future Activity",
        value: staleDeals,
        meta: "Past close dates or no meaningful future movement",
        status: statusForCount(staleDeals, 3, 10),
        action: "Reset close dates or close out dead deals cleanly.",
      },
      {
        key: "overdue_tasks",
        label: "Overdue Execution Items",
        value: overdueTasks,
        meta: "Open tasks past due date",
        status: statusForCount(overdueTasks, 5, 20),
        action: "Clear execution drag before it damages delivery or sales.",
      },
      {
        key: "failed_automations",
        label: "Failed Automations / Workflows",
        value: null,
        meta: "Not yet instrumented in database",
        status: "yellow",
        action: "Add workflow telemetry table or error logging for automation monitoring.",
      },
    ];

    const ycbmLast30 = ycbm.filter((r) => {
      const d = r.created_at ? new Date(r.created_at) : null;
      return d && !Number.isNaN(d.getTime()) && Date.now() - d.getTime() <= 1000 * 60 * 60 * 24 * 30;
    }).length;

    const firstOutreachByLead = new Map<string, string>();
    for (const evt of outreachEvents) {
      if (!evt.lead_id || !evt.created_at) continue;
      const existing = firstOutreachByLead.get(evt.lead_id);
      if (!existing || new Date(evt.created_at).getTime() < new Date(existing).getTime()) {
        firstOutreachByLead.set(evt.lead_id, evt.created_at);
      }
    }

    const entryDurationsHours = leads
      .map((lead) => {
        const firstOutreach = firstOutreachByLead.get(lead.id);
        if (!firstOutreach || !lead.created_at) return null;
        const a = new Date(lead.created_at).getTime();
        const b = new Date(firstOutreach).getTime();
        if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
        return (b - a) / (1000 * 60 * 60);
      })
      .filter((v): v is number => v != null);

    const avgHoursToFirstOutreach = entryDurationsHours.length
      ? Math.round((entryDurationsHours.reduce((s, v) => s + v, 0) / entryDurationsHours.length) * 10) / 10
      : null;

    const approxStorageObjects =
      contacts.length +
      companies.length +
      leads.length +
      opps.length +
      projects.length +
      tasks.length +
      meetings.length +
      outreachEvents.length;

    const technical = [
      {
        key: "integration_sync",
        label: "API / Integration Sync Status",
        value: ycbmLast30,
        meta: `${ycbmLast30} YCBM sync item(s) in the last 30 days`,
        status: ycbmLast30 > 0 ? "green" : "yellow",
        action: "Verify live external integrations if this drops unexpectedly.",
      },
      {
        key: "data_entry_speed",
        label: "Data Entry Speed",
        value: avgHoursToFirstOutreach,
        meta: avgHoursToFirstOutreach == null ? "No outreach timing data yet" : `${avgHoursToFirstOutreach} hours from lead creation to first outreach`,
        status:
          avgHoursToFirstOutreach == null
            ? "yellow"
            : avgHoursToFirstOutreach <= 24
            ? "green"
            : avgHoursToFirstOutreach <= 72
            ? "yellow"
            : "red",
        action: "Reduce time from lead creation to first outbound touch.",
      },
      {
        key: "platform_uptime",
        label: "Platform Uptime",
        value: null,
        meta: "Not yet instrumented",
        status: "yellow",
        action: "Add uptime monitoring to production hosting.",
      },
      {
        key: "storage_usage",
        label: "Storage Usage",
        value: approxStorageObjects,
        meta: `${approxStorageObjects} tracked records across operational tables`,
        status: "green",
        action: "Add storage bucket metrics if document uploads become heavy.",
      },
    ];

    const bounced = outreachEvents.filter((e) =>
      String(e.delivery_status || "").toLowerCase().includes("bounce")
    ).length;
    const sent = outreachEvents.filter((e) =>
      ["sent", "sent_manual", "delivered"].includes(String(e.delivery_status || "").toLowerCase())
    ).length;
    const bounceRate = pct(bounced, Math.max(1, bounced + sent));

    const emailMarketing = [
      {
        key: "bounce_rate",
        label: "Marketing Email Bounce Rate",
        value: `${bounceRate}%`,
        meta: `${bounced} bounce(s) across ${bounced + sent} tracked send events`,
        status: statusForRatio(bounceRate, 2, 5),
        action: "Clean invalid email addresses and suppress bad recipients.",
      },
      {
        key: "unsubscribes",
        label: "Opt-out / Unsubscribe Tracking",
        value: null,
        meta: "Not yet instrumented",
        status: "yellow",
        action: "Add unsubscribe tracking if marketing sends are part of Freshware workflows.",
      },
    ];

    return NextResponse.json({
      generated_at: nowIso,
      summary: {
        overallStatus: [dataQuality, workflow, technical, emailMarketing]
          .flat()
          .some((x) => x.status === "red")
          ? "red"
          : [dataQuality, workflow, technical, emailMarketing]
              .flat()
              .some((x) => x.status === "yellow")
          ? "yellow"
          : "green",
        accountsScoped: true,
      },
      dataQuality,
      adoption,
      workflow,
      technical,
      emailMarketing,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}