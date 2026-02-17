import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET() {
  try {
    const { supabase, user, profile } = await requireViewer();

    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!profile || profile.role === "PENDING") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isStaff(profile.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }

    const accountId = profile.account_id;
    if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

    const now = new Date().toISOString();

    // Overdue tasks for this account
    const { data, error } = await supabase
      .from("tasks")
      .select("task_id, title, status, due_at, project_id, opportunity_id, assigned_to, created_at")
      .eq("account_id", accountId)
      .not("due_at", "is", null)
      .lt("due_at", now)
      .neq("status", "Done")
      .order("due_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      {
        overdue: data || [],
        count: (data || []).length,
        as_of: now,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
