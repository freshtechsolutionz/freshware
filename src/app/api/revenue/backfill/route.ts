import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function normalizeDateOnly(v: any) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (isNaN(d.getTime())) return null;

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }
  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const accountId = profile.account_id;

  const [oppRes, projectRes, existingRevenueRes] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, account_id, company_id, amount, stage, close_date, name")
      .eq("account_id", accountId)
      .eq("stage", "won"),

    supabase
      .from("projects")
      .select("id, account_id, company_id, name, support_monthly_cost, support_cost, support_start_date, support_next_due_date, support_due_date, support_status")
      .eq("account_id", accountId),

    supabase
      .from("revenue_entries")
      .select("id, opportunity_id, project_id, source, frequency")
      .eq("account_id", accountId),
  ]);

  if (oppRes.error) return NextResponse.json({ error: oppRes.error.message }, { status: 500 });
  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 500 });
  if (existingRevenueRes.error) {
    return NextResponse.json({ error: existingRevenueRes.error.message }, { status: 500 });
  }

  const wonOpps = (oppRes.data || []) as Array<{
    id: string;
    account_id: string;
    company_id: string | null;
    amount: number | null;
    stage: string | null;
    close_date: string | null;
    name: string | null;
  }>;

  const projects = (projectRes.data || []) as Array<{
    id: string;
    account_id: string;
    company_id: string | null;
    name: string | null;
    support_monthly_cost: number | null;
    support_cost: number | null;
    support_start_date: string | null;
    support_next_due_date: string | null;
    support_due_date: string | null;
    support_status: string | null;
  }>;

  const existingRevenue = (existingRevenueRes.data || []) as Array<{
    id: string;
    opportunity_id: string | null;
    project_id: string | null;
    source: string | null;
    frequency: string | null;
  }>;

  const existingOppMap = new Map<string, string>();
  const existingProjectSupportMap = new Map<string, string>();

  for (const row of existingRevenue) {
    if (row.opportunity_id && row.source === "opportunity" && row.frequency === "one_time") {
      existingOppMap.set(row.opportunity_id, row.id);
    }
    if (row.project_id && row.source === "project_support" && row.frequency === "monthly") {
      existingProjectSupportMap.set(row.project_id, row.id);
    }
  }

  let oppCreated = 0;
  let oppUpdated = 0;
  let projectCreated = 0;
  let projectUpdated = 0;
  let skippedOpps = 0;
  let skippedProjects = 0;
  const errors: Array<{ kind: string; id: string; error: string }> = [];

  // Backfill won opportunities as one-time revenue
  for (const opp of wonOpps) {
    try {
      const amount = Number(opp.amount || 0);
      if (amount <= 0) {
        skippedOpps++;
        continue;
      }

      const recognizedOn =
        normalizeDateOnly(opp.close_date) ||
        normalizeDateOnly(new Date().toISOString());

      const payload = {
        title: opp.name ? `${opp.name} Revenue` : "Won Opportunity Revenue",
        amount,
        recognized_on: recognizedOn,
        revenue_type: "project",
        category: "development",
        status: "recognized",
        source: "opportunity",
        frequency: "one_time",
        company_id: opp.company_id || null,
        opportunity_id: opp.id,
        updated_at: new Date().toISOString(),
      };

      const existingId = existingOppMap.get(opp.id);

      if (existingId) {
        const { error } = await supabase
          .from("revenue_entries")
          .update(payload)
          .eq("id", existingId)
          .eq("account_id", accountId);

        if (error) throw error;
        oppUpdated++;
      } else {
        const { error } = await supabase
          .from("revenue_entries")
          .insert({
            account_id: accountId,
            created_by: user.id,
            description: "Auto-generated from won opportunity.",
            ...payload,
          });

        if (error) throw error;
        oppCreated++;
      }
    } catch (e: any) {
      errors.push({
        kind: "opportunity",
        id: opp.id,
        error: e?.message || "Unknown error",
      });
    }
  }

  // Backfill active project support as recurring revenue
  for (const project of projects) {
    try {
      const monthly = Number(project.support_monthly_cost ?? project.support_cost ?? 0);
      const supportStatus = String(project.support_status || "").toLowerCase();

      if (monthly <= 0) {
        skippedProjects++;
        continue;
      }

      if (supportStatus && ["inactive", "paused", "canceled"].includes(supportStatus)) {
        skippedProjects++;
        continue;
      }

      const startDate =
        normalizeDateOnly(project.support_start_date) ||
        normalizeDateOnly(project.support_next_due_date) ||
        normalizeDateOnly(project.support_due_date) ||
        normalizeDateOnly(new Date().toISOString());

      const payload = {
        title: project.name ? `${project.name} Monthly Support` : "Monthly Support",
        amount: monthly,
        recognized_on: startDate,
        start_date: startDate,
        revenue_type: "support",
        category: "monthly_support",
        status: "active",
        source: "project_support",
        frequency: "monthly",
        company_id: project.company_id || null,
        project_id: project.id,
        updated_at: new Date().toISOString(),
      };

      const existingId = existingProjectSupportMap.get(project.id);

      if (existingId) {
        const { error } = await supabase
          .from("revenue_entries")
          .update(payload)
          .eq("id", existingId)
          .eq("account_id", accountId);

        if (error) throw error;
        projectUpdated++;
      } else {
        const { error } = await supabase
          .from("revenue_entries")
          .insert({
            account_id: accountId,
            created_by: user.id,
            description: "Recurring monthly support revenue tied to project.",
            ...payload,
          });

        if (error) throw error;
        projectCreated++;
      }
    } catch (e: any) {
      errors.push({
        kind: "project_support",
        id: project.id,
        error: e?.message || "Unknown error",
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      summary: {
        oppCreated,
        oppUpdated,
        projectCreated,
        projectUpdated,
        skippedOpps,
        skippedProjects,
        errors: errors.length,
      },
      errors,
    },
    { status: 200 }
  );
}