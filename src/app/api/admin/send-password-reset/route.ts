import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email: string };
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return NextResponse.json({ error: "Email required." }, { status: 400 });

    // Auth check (cookie-based session)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    const role = (me?.role ?? "").toUpperCase();
    const isAdmin = role === "CEO" || role === "ADMIN";
    if (!isAdmin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    // Use service role client to avoid edge cases
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing." }, { status: 500 });

    const admin = createClient(url, serviceKey);

    // Send Supabase password recovery email (via GoTrue)
    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/auth/reset?next=${encodeURIComponent("/dashboard")}`;

    const { error } = await admin.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
