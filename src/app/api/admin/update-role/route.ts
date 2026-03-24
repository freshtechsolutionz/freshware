import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const ALLOWED_ROLES = ["CEO", "ADMIN", "STAFF", "CLIENT", "CLIENT_ADMIN", "CLIENT_USER", "PENDING"];

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: actingProfile, error: actingProfileError } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (actingProfileError) {
    return NextResponse.json({ error: actingProfileError.message }, { status: 500 });
  }

  if (!actingProfile || !["CEO", "ADMIN"].includes(String(actingProfile.role || "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || "").trim();
  const role = String(body?.role || "").trim().toUpperCase();

  if (!userId || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!actingProfile.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", userId)
    .eq("account_id", actingProfile.account_id)
    .maybeSingle();

  if (targetProfileError) {
    return NextResponse.json({ error: targetProfileError.message }, { status: 500 });
  }

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found in your account" }, { status: 404 });
  }

  if (String(targetProfile.role || "").toUpperCase() === "CEO" && String(actingProfile.role || "").toUpperCase() !== "CEO") {
    return NextResponse.json({ error: "Only the CEO can change another CEO" }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .eq("account_id", actingProfile.account_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}