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
  return { ok: true as const, profile: profile as ProfileRow };
}

export async function GET(req: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer.ok) return NextResponse.json({ error: viewer.reason }, { status: 401 });

    const { profile } = viewer;
    if (!profile.account_id) return NextResponse.json({ error: "Missing profiles.account_id" }, { status: 400 });
    if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const svc = svcSupabase();
    if (!svc) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

    const accountId = profile.account_id;
    const url = new URL(req.url);
    const stageFilter = (url.searchParams.get("stage") || "").trim();

    const oppRes = await svc
      .from("opportunities")
      .select("id, name, stage, amount, created_at")
      .eq("account_id", accountId);

    if (oppRes.error) return NextResponse.json({ error: oppRes.error.message }, { status: 500 });

    const rows = (oppRes.data || []) as any[];

    const open = rows.filter((r) => {
      const s = String(r.stage || "").toLowerCase();
      return s !== "won" && s !== "lost";
    });

    const filtered = stageFilter ? open.filter((r) => String(r.stage || "") === stageFilter) : open;

    const byStageMap: Record<string, { count: number; amount: number }> = {};
    for (const r of open) {
      const st = String(r.stage || "Unstaged");
      if (!byStageMap[st]) byStageMap[st] = { count: 0, amount: 0 };
      byStageMap[st].count += 1;
      byStageMap[st].amount += Number(r.amount) || 0;
    }

    const byStage = Object.entries(byStageMap)
      .map(([stage, v]) => ({ stage, count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);

    const deals = filtered
      .slice()
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .map((r) => ({
        id: r.id,
        name: r.name || "Untitled",
        stage: r.stage || "Unstaged",
        amount: Number(r.amount) || 0,
        created_at: r.created_at || null,
      }));

    const openPipeline = open.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return NextResponse.json({
      stageFilter: stageFilter || null,
      totals: { openDeals: open.length, openPipeline },
      byStage,
      deals,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
