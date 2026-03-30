import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }

  try {
    const { data: leadsRaw, error: leadsError } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("account_id", profile.account_id);

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const leads = leadsRaw || [];

    const newLeads = leads.filter(
      (l) => String(l.status || "").toUpperCase() === "NEW"
    ).length;

    const responded = leads.filter(
      (l) => String(l.outreach_status || "").toUpperCase() === "RESPONDED"
    ).length;

    const followUpDue = leads.filter((l) => {
      if (!l.next_follow_up_at) return false;
      const d = new Date(l.next_follow_up_at);
      if (Number.isNaN(d.getTime())) return false;
      return d.getTime() <= Date.now();
    }).length;

    const highScore = leads.filter(
      (l) => Number(l.total_score || 0) >= 80
    ).length;

    return NextResponse.json({
      ok: true,
      summary: {
        newLeads,
        responded,
        followUpDue,
        highScore,
        total: leads.length,
      },
    });
  } catch (error) {
    console.error("GET /api/ceo/digest error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}