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
    const healthFilter = (url.searchParams.get("health") || "").trim();

    const projRes = await svc
      .from("projects")
      .select("id, name, status, health, due_date, start_date")
      .eq("account_id", accountId);

    if (projRes.error) return NextResponse.json({ error: projRes.error.message }, { status: 500 });

    const rows = (projRes.data || []) as any[];

    const active = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return !["done", "closed", "completed", "cancelled"].includes(s);
    });

    const map: Record<string, number> = {};
    for (const p of active) {
      const h = String(p.health || "Unknown");
      map[h] = (map[h] || 0) + 1;
    }

    const buckets = Object.entries(map)
      .map(([health, count]) => ({ health, count }))
      .sort((a, b) => b.count - a.count);

    const filtered = healthFilter ? active.filter((p) => String(p.health || "Unknown") === healthFilter) : active;

    const projects = filtered.map((p) => ({
      id: p.id,
      name: p.name || "Untitled project",
      status: p.status || null,
      health: p.health || "Unknown",
      start_date: p.start_date || null,
      due_date: p.due_date || null,
    }));

    return NextResponse.json({
      healthFilter: healthFilter || null,
      buckets,
      activeCount: active.length,
      projects,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
