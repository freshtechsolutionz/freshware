// src/app/api/opportunities/route.ts

import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));

    const name = body?.name ? String(body.name).trim() : "";
    const stage = body?.stage ? String(body.stage).trim() : null;
    const serviceLine = body?.serviceLine ? String(body.serviceLine).trim() : null;
    const amount = body?.amount == null ? 0 : Number(body.amount) || 0;

    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }
    if (!serviceLine) {
      return NextResponse.json({ error: "Missing required field: serviceLine" }, { status: 400 });
    }

    if (!profile.account_id) {
      return NextResponse.json(
        { error: "Your profile is missing account_id. Assign your user to an account first." },
        { status: 400 }
      );
    }

    const insertRow: any = {
      name,
      stage, // can be null; trigger will normalize to 'new'
      service_line: serviceLine,
      amount,
      account_id: profile.account_id, // ✅ AUTO ASSIGN
      owner_user_id: user.id,         // ✅ OWNER
      last_activity_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("opportunities")
      .insert(insertRow)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ opportunity: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}