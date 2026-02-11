import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      access_request_id,
      email,
      full_name,
      role,
      account_id,
      reviewer_id,
    } = body as {
      access_request_id: string;
      email: string;
      full_name: string;
      role: string;
      account_id: string;
      reviewer_id?: string | null;
    };

    if (!access_request_id || !email || !full_name || !role || !account_id) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not set." },
        { status: 500 }
      );
    }

    const admin = createClient(url, serviceKey);

    // 1) Create auth user if they don’t exist (reuse if exists)
    let userId: string | null = null;

    const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
    const found = existing.data.users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase()
    );
    if (found) userId = found.id;

    if (!userId) {
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (created.error) {
        return NextResponse.json(
          { error: created.error.message },
          { status: 400 }
        );
      }

      userId = created.data.user?.id || null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unable to determine auth user id." },
        { status: 500 }
      );
    }

    // 2) Upsert profile
    const upsertRes = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name,
        role,
        account_id,
      },
      { onConflict: "id" }
    );

    if (upsertRes.error) {
      return NextResponse.json(
        { error: upsertRes.error.message },
        { status: 400 }
      );
    }

    // 3) Mark access request approved (reviewed_by should be the ADMIN who approved)
    const approveRes = await admin
      .from("access_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer_id ?? null,
      })
      .eq("id", access_request_id);

    if (approveRes.error) {
      return NextResponse.json(
        { error: approveRes.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      reviewed_by: reviewer_id ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
