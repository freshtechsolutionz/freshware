import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("account_id", profile.account_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}