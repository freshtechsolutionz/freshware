import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  // Confirm project belongs to this account
  const proj = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (proj.error) return NextResponse.json({ error: proj.error.message }, { status: 500 });
  if (!proj.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // Load tasks scoped to project + account
  const { data, error } = await supabase
    .from("tasks")
    .select("task_id, title, description, status, due_at, assigned_to, project_id")
    .eq("account_id", accountId)
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as any[];

  // Hydrate assignee names
  const ids = Array.from(new Set(rows.map((t) => t.assigned_to).filter(Boolean))) as string[];
  let nameMap: Record<string, string> = {};

  if (ids.length) {
    const usersRes = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .eq("account_id", accountId);

    if (!usersRes.error) {
      nameMap = {};
      for (const u of (usersRes.data || []) as any[]) {
        nameMap[u.id] = u.full_name || u.id;
      }
    }
  }

  const hydrated = rows.map((t) => ({
    ...t,
    assignee_name: t.assigned_to ? nameMap[t.assigned_to] || null : null,
  }));

  return NextResponse.json({ tasks: hydrated }, { status: 200 });
}
