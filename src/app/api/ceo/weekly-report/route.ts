import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProfileRow = { id: string; role: string | null; account_id: string | null };

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function svcSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getViewer() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, reason: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return { ok: false as const, reason: "Missing profile row" };
  return { ok: true as const, profile: profile as ProfileRow, supabase };
}

function fmtMoney(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n || 0));
}

function fmtNum(n: number) {
  return new Intl.NumberFormat().format(Math.round(n || 0));
}

export async function GET() {
  try {
    const viewer = await getViewer();
    if (!viewer.ok) return NextResponse.json({ error: viewer.reason }, { status: 401 });

    const { profile, supabase } = viewer;
    if (!profile.account_id) return NextResponse.json({ error: "Missing profiles.account_id" }, { status: 400 });
    if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const svc = svcSupabase();
    if (!svc) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

    const accountId = profile.account_id;

    const [overviewRes, digestRes, mondayRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/ceo/overview`, {
        headers: { cookie: "" },
        cache: "no-store",
      }).catch(() => null),
      supabase
        .from("lead_prospects")
        .select("status, outreach_status, next_follow_up_at, total_score")
        .eq("account_id", accountId),
      svc.rpc("ceo_monday_summary"),
    ]);

    let overview: any = null;
    if (overviewRes) {
      const ct = overviewRes.headers.get("content-type") || "";
      if (ct.toLowerCase().includes("application/json")) {
        const json = await overviewRes.json().catch(() => null);
        overview = json?.kpis ? json.kpis : null;
      }
    }

    const summary = mondayRes.error ? null : mondayRes.data;

    const leadRows = (digestRes.data || []) as Array<{
      status: string | null;
      outreach_status: string | null;
      next_follow_up_at: string | null;
      total_score: number | null;
    }>;

    const leadDigest = {
      newLeads: leadRows.filter((l) => String(l.status || "").toUpperCase() === "NEW").length,
      responded: leadRows.filter((l) => String(l.outreach_status || "").toUpperCase() === "RESPONDED").length,
      followUpDue: leadRows.filter((l) => {
        if (!l.next_follow_up_at) return false;
        const d = new Date(l.next_follow_up_at);
        return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
      }).length,
      highScore: leadRows.filter((l) => Number(l.total_score || 0) >= 80).length,
      total: leadRows.length,
    };

    const lines: string[] = [];
    lines.push("Freshware Weekly Executive Report");
    lines.push("");

    if (summary?.kpis) {
      lines.push("Executive Scoreboard");
      lines.push(
        `Open pipeline: ${fmtMoney(Number(summary.kpis.pipeline_amount_all || 0))} across ${fmtNum(Number(summary.kpis.opp_count_all || 0))} total opportunities`
      );
      lines.push(
        `Weighted pipeline: ${fmtMoney(Number(summary.kpis.weighted_pipeline_all || 0))}`
      );
      lines.push(
        `Enterprise weighted pipeline: ${fmtMoney(Number(summary.kpis.weighted_pipeline_enterprise || 0))}`
      );
      lines.push(
        `Average days since activity: ${fmtNum(Number(summary.kpis.avg_days_since_activity_all || 0))}`
      );
      lines.push("");
    }

    if (overview) {
      lines.push("Execution and Delivery");
      lines.push(`Active projects: ${fmtNum(Number(overview.activeProjects || 0))} (total ${fmtNum(Number(overview.totalProjects || 0))})`);
      lines.push(`Tasks: ${fmtNum(Number(overview.overdueTasks || 0))} overdue, ${fmtNum(Number(overview.blockedTasks || 0))} blocked`);
      lines.push(`Meetings booked: ${fmtNum(Number(overview.meetingsBooked || 0))}`);
      lines.push("");
    }

    lines.push("Lead Generation");
    lines.push(`New leads: ${fmtNum(leadDigest.newLeads)}`);
    lines.push(`High-score leads (80+): ${fmtNum(leadDigest.highScore)}`);
    lines.push(`Follow-ups due: ${fmtNum(leadDigest.followUpDue)}`);
    lines.push(`Responded outreach: ${fmtNum(leadDigest.responded)}`);
    lines.push("");

    lines.push("Pipeline focus");
    if (summary?.stage_breakdown?.length) {
      for (const stage of summary.stage_breakdown.slice(0, 5)) {
        lines.push(
          `- ${stage.stage}: ${fmtMoney(Number(stage.pipeline_amount || 0))} (${fmtNum(Number(stage.opp_count || 0))} deals)`
        );
      }
    } else {
      lines.push("No stage breakdown available.");
    }
    lines.push("");

    lines.push("Stuck deals");
    if (summary?.stuck_deals?.length) {
      for (const deal of summary.stuck_deals.slice(0, 5)) {
        lines.push(
          `- ${String(deal.opportunity_name || "Unnamed deal").slice(0, 60)}: ${fmtMoney(Number(deal.weighted_amount || deal.amount || 0))} • ${fmtNum(Number(deal.days_since_activity || 0))} days idle`
        );
      }
    } else {
      lines.push("No stuck deals found.");
    }
    lines.push("");

    lines.push("Enterprise blockers");
    if (summary?.enterprise_blockers?.length) {
      for (const deal of summary.enterprise_blockers.slice(0, 5)) {
        const blockers = [
          deal.missing_budget ? "budget" : null,
          deal.missing_timeline ? "timeline" : null,
          deal.missing_decision_maker ? "decision maker" : null,
        ]
          .filter(Boolean)
          .join(", ");
        lines.push(
          `- ${String(deal.opportunity_name || "Unnamed deal").slice(0, 60)}: missing ${blockers || "core info"}`
        );
      }
    } else {
      lines.push("No enterprise blockers found.");
    }
    lines.push("");

    lines.push("Executive priorities");
    lines.push("1) Move stuck deals to a clear next step with owner and date.");
    lines.push("2) Clear enterprise blockers on high-value opportunities.");
    lines.push("3) Work overdue follow-ups and high-score leads before new sourcing.");
    lines.push("4) Reduce overdue and blocked execution items so delivery does not drag growth.");
    lines.push("");

    return NextResponse.json({
      text: lines.join("\n"),
      generated_at: new Date().toISOString(),
      summary: summary || null,
      overview: overview || null,
      lead_digest: leadDigest,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}