import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }
  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id: unknown) => String(id)).filter(Boolean)
      : [];

    if (!ids.length) {
      return NextResponse.json({ error: "No lead IDs provided." }, { status: 400 });
    }

    const { error } = await supabase
      .from("lead_prospects")
      .delete()
      .eq("account_id", profile.account_id)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted_count: ids.length });
  } catch (error) {
    console.error("POST /api/lead-prospects/bulk-delete error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}