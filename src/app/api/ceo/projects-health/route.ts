import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function computeHealth(p: {
  due_date?: string | null;
  support_next_due_date?: string | null;
  status?: string | null;
  health?: string | null;
}) {
  const explicit = (p.health || "").toUpperCase().trim();
  if (["RED", "YELLOW", "GREEN", "UNKNOWN"].includes(explicit)) return explicit;

  const status = (p.status || "").toLowerCase().trim();
  const doneLike =
    status.includes("done") ||
    status.includes("complete") ||
    status.includes("closed");

  if (status === "on_hold" || status === "paused") return "YELLOW";

  const dueSource = p.due_date || p.support_next_due_date || null;
  if (!dueSource) return "UNKNOWN";

  const due = new Date(dueSource);
  if (isNaN(due.getTime())) return "UNKNOWN";

  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (!doneLike && diffDays < 0) return "RED";
  if (!doneLike && diffDays <= 7) return "YELLOW";
  return "GREEN";
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

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, name, status, stage, start_date, due_date, support_next_due_date, support_status, progress_percent, health, created_at"
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const projects = (data || []).map((p: any) => ({
      ...p,
      computed_health: computeHealth(p),
    }));

    const counts = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 } as Record<string, number>;
    for (const p of projects as any[]) {
      const h = String(p.computed_health || "UNKNOWN").toUpperCase();
      counts[h] = (counts[h] || 0) + 1;
    }

    return NextResponse.json({ counts, projects }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}