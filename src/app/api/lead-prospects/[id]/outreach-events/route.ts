import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await context.params;

    const { data, error } = await supabase
      .from("lead_outreach_events")
      .select("*")
      .eq("account_id", profile.account_id)
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      events: data || [],
    });
  } catch (error) {
    console.error("GET /api/lead-prospects/[id]/outreach-events error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}