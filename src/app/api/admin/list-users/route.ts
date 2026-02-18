import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AuthUserLite = {
  id: string;
  email: string | null;
};

export async function GET(req: Request) {
  try {
    // Viewer session (cookie-based)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    // Viewer role + account
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("id, role, account_id")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });

    const roleUpper = (me?.role ?? "").toUpperCase();
    const isAdmin = roleUpper === "CEO" || roleUpper === "ADMIN";
    if (!isAdmin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const accountId = me?.account_id ?? null;
    if (!accountId) return NextResponse.json({ error: "Your profile is missing account_id." }, { status: 400 });

    // Pull profiles in same account (public data)
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, account_id, avatar_url, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    // Service-role client (Auth emails)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing." }, { status: 500 });

    const admin = createClient(url, serviceKey);

    // List auth users and map id -> email
    // NOTE: If you have >2000 users, we can paginate later. This is fine for now.
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 });

    const emailById = new Map<string, string | null>();
    for (const u of list.data.users as any[]) {
      emailById.set(u.id, (u.email ?? null) as string | null);
    }

    // Attach email to each profile row
    const merged = (profiles ?? []).map((p: any) => ({
      ...p,
      email: emailById.get(p.id) ?? null,
    }));

    return NextResponse.json({ ok: true, users: merged });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
