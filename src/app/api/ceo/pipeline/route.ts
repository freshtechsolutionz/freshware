import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export async function GET(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const url = new URL(req.url);
  const rangeDays = toInt(url.searchParams.get("range"), 30);

  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, rangeDays));
  const sinceIso = since.toISOString();

  // IMPORTANT:
  // opportunities.status DOES NOT EXIST in your schema.
  // Freshware uses opportunities.stage.
  const { data, error } = await supabase
    .from("opportunities")
    .select("id, stage, amount, created_at")
    .eq("account_id", accountId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as Array<{
    id: string;
    stage: string | null;
    amount: number | null;
    created_at: string | null;
  }>;

  const byStage: Record<string, { count: number; totalAmount: number }> = {};

  for (const r of rows) {
    const stage = (r.stage || "Unknown").trim() || "Unknown";
    const amt = Number(r.amount || 0) || 0;

    if (!byStage[stage]) byStage[stage] = { count: 0, totalAmount: 0 };
    byStage[stage].count += 1;
    byStage[stage].totalAmount += amt;
  }

  return NextResponse.json(
    {
      range_days: rangeDays,
      since: sinceIso,
      total_opportunities: rows.length,
      byStage,
    },
    { status: 200 }
  );
}
return NextResponse.json(
  {
    __pipeline_route_version: "2026-02-17-stage-only",
    range_days: rangeDays,
    since: sinceIso,
    total_opportunities: rows.length,
    byStage,
  },
  { status: 200 }
);
