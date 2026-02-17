import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET(req: Request) {
  try {
    const { supabase, user, profile } = await requireViewer();

    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!profile || profile.role === "PENDING") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isStaff(profile.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }

    const accountId = profile.account_id;
    if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "30").trim(); // days
    const days = Number(range);
    const safeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;

    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    const sinceIso = since.toISOString();

    // Pull opps for pipeline breakdown
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, name, stage, amount, status, created_at")
      .eq("account_id", accountId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];

    // stage totals
    const byStage: Record<string, { count: number; totalAmount: number }> = {};
    for (const o of rows as any[]) {
      const stage = String(o.stage || "Unknown");
      const amt = Number(o.amount || 0);
      if (!byStage[stage]) byStage[stage] = { count: 0, totalAmount: 0 };
      byStage[stage].count += 1;
      byStage[stage].totalAmount += amt;
    }

    return NextResponse.json(
      {
        range_days: safeDays,
        since: sinceIso,
        total_opportunities: rows.length,
        byStage,
        opportunities: rows,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
