import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }

  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = profile.account_id;
  const { id } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || "").trim().toUpperCase();
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    const allowed = ["NOT_CONTACTED", "CONTACTED", "RESPONDED", "CLOSED"];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: "Invalid outreach status" }, { status: 400 });
    }

    const { error } = await supabase
      .from("lead_prospects")
      .update({
        outreach_status: status,
        outreach_notes: notes || null,
        last_contacted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("account_id", accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/update-outreach error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}