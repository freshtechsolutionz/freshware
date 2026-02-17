import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ProfileRow = { id: string; role: string | null; account_id: string | null };

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function svcSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getViewer() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, reason: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return { ok: false as const, reason: "Missing profile row" };
  return { ok: true as const, profile: profile as ProfileRow };
}

export async function GET() {
  try {
    const viewer = await getViewer();
    if (!viewer.ok) return NextResponse.json({ error: viewer.reason }, { status: 401 });

    const { profile } = viewer;
    if (!profile.account_id) return NextResponse.json({ error: "Missing profiles.account_id" }, { status: 400 });
    if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const svc = svcSupabase();
    if (!svc) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

    const accountId = profile.account_id;
    const now = new Date();

    const tasksRes = await svc
      .from("tasks")
      .select("task_id, title, status, due_at, assigned_to, project_id")
      .eq("account_id", accountId);

    if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 });

    const tasks = (tasksRes.data || []) as any[];

    const overdue = tasks
      .filter((t) => {
        const st = String(t.status || "").toLowerCase();
        const done = st === "done";
        const due = t.due_at ? new Date(String(t.due_at)) : null;
        return !!due && !done && due.getTime() < now.getTime();
      })
      .sort((a, b) => new Date(String(a.due_at)).getTime() - new Date(String(b.due_at)).getTime());

    const blocked = tasks.filter((t) => String(t.status || "").toLowerCase() === "blocked");

    const assigneeIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean))) as string[];
    const assigneeMap: Record<string, string> = {};

    if (assigneeIds.length) {
      const profRes = await svc.from("profiles").select("id, full_name").in("id", assigneeIds).eq("account_id", accountId);
      if (!profRes.error) {
        for (const p of (profRes.data || []) as any[]) assigneeMap[p.id] = p.full_name || p.id;
      }
    }

    const enrich = (t: any) => ({
      task_id: t.task_id,
      title: t.title || "Untitled",
      status: t.status || "New",
      due_at: t.due_at || null,
      assigned_to: t.assigned_to || null,
      assignee_name: t.assigned_to ? assigneeMap[t.assigned_to] || t.assigned_to : null,
      project_id: t.project_id || null,
    });

    return NextResponse.json({
      now: now.toISOString(),
      counts: { overdue: overdue.length, blocked: blocked.length },
      overdue: overdue.map(enrich),
      blocked: blocked.map(enrich),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
