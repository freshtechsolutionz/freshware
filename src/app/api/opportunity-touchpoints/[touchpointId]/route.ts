import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function DELETE(_req: Request, context: { params: Promise<{ touchpointId: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Let RLS enforce admin-only delete (policy otp_delete_admin)
  const { touchpointId } = await context.params;

  const { error } = await supabase
    .from("opportunity_touchpoints")
    .delete()
    .eq("id", touchpointId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}