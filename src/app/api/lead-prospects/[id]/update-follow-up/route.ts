import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const nextFollowUpAt = normalizeDate(body?.next_follow_up_at);
    const followUpStatus = String(body?.follow_up_status || "NONE").trim().toUpperCase();
    const followUpNotes =
      typeof body?.follow_up_notes === "string" && body.follow_up_notes.trim()
        ? body.follow_up_notes.trim()
        : null;

    const allowed = ["NONE", "SCHEDULED", "DUE", "COMPLETED", "PAUSED"];
    if (!allowed.includes(followUpStatus)) {
      return NextResponse.json({ error: "Invalid follow-up status" }, { status: 400 });
    }

    const { error } = await supabase
      .from("lead_prospects")
      .update({
        next_follow_up_at: nextFollowUpAt,
        follow_up_status: followUpStatus,
        follow_up_notes: followUpNotes,
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      next_follow_up_at: nextFollowUpAt,
      follow_up_status: followUpStatus,
      follow_up_notes: followUpNotes,
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/update-follow-up error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}