import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Syncs Auth emails -> public.profiles.email
 * Scope: ONLY profiles in the current admin's account_id (safe + fast).
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    // Viewer session (cookie-based)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    // Must be CEO/ADMIN and must have account_id
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role, account_id")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });

    const roleUpper = (me?.role ?? "").toUpperCase();
    const isAdmin = roleUpper === "CEO" || roleUpper === "ADMIN";
    if (!isAdmin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const accountId = me?.account_id ?? null;
    if (!accountId) return NextResponse.json({ error: "Your profile is missing account_id." }, { status: 400 });

    // Service role client (read auth.users + write profiles bypassing RLS)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing." }, { status: 500 });

    const admin = createClient(url, serviceKey);

    // 1) Pull profiles in this admin's account (only ids + current email)
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, email, account_id")
      .eq("account_id", accountId);

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    const profileIds = (profiles ?? []).map((p: any) => p.id as string);
    if (profileIds.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, missing_auth: 0 });
    }

    // 2) Pull auth users (up to 2000 — plenty for now)
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 });

    const emailById = new Map<string, string>();
    for (const u of list.data.users as any[]) {
      if (u?.id && u?.email) emailById.set(u.id, String(u.email).toLowerCase());
    }

    // 3) Build updates only where we have an auth email and profiles.email differs
    const updates: Array<{ id: string; email: string }> = [];
    let missingAuth = 0;

    for (const pid of profileIds) {
      const authEmail = emailById.get(pid);
      if (!authEmail) {
        missingAuth += 1;
        continue;
      }

      const current = (profiles as any[]).find((p) => p.id === pid)?.email ?? null;
      const currentClean = (current || "").trim().toLowerCase();
      if (currentClean !== authEmail) {
        updates.push({ id: pid, email: authEmail });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, missing_auth: missingAuth });
    }

    // 4) Apply updates (service role bypasses RLS)
    // Upsert is easiest (onConflict id)
    const { error: upErr } = await admin.from("profiles").upsert(updates, { onConflict: "id" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      updated: updates.length,
      missing_auth: missingAuth,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
