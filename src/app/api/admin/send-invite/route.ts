import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json({ error: "Missing email." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceKey) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set." }, { status: 500 });
    }

    const admin = createClient(url, serviceKey);

    const redirectTo =
      process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/portal/setup`
        : undefined;

    const invited = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    if (invited.error) {
      return NextResponse.json({ error: invited.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
