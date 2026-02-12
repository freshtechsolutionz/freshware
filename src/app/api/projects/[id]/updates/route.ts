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

  const staff = isStaff(profile.role);

  const { data, error } = await supabase
    .from("project_updates")
    .select("id, project_id, account_id, created_by, created_at, title, body, client_visible")
    .eq("account_id", accountId)
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as any[];
  const visible = staff ? rows : rows.filter((r) => r.client_visible);

  // Author names
  const authorIds = Array.from(new Set(visible.map((u) => u.created_by).filter(Boolean))) as string[];
  const authorMap: Record<string, string> = {};

  if (authorIds.length) {
    const authorsRes = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds)
      .eq("account_id", accountId);

    if (!authorsRes.error) {
      for (const a of (authorsRes.data || []) as any[]) {
        authorMap[a.id] = a.full_name || a.id;
      }
    }
  }

  const out = visible.map((u) => ({
    ...u,
    author_name: u.created_by ? authorMap[u.created_by] || null : null,
  }));

  return NextResponse.json({ updates: out }, { status: 200 });
}

export async function POST(
  req: Request,
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

  // Verify the project belongs to this account
  const projectRes = await supabase
    .from("projects")
    .select("id, account_id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 500 });
  if (!projectRes.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  const b =
    body?.body === null || body?.body === undefined ? null : String(body.body).trim();

  if (!title) return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });

  const staff = isStaff(profile.role);
  const client_visible = staff ? !!body?.client_visible : true;

  const { data, error } = await supabase
    .from("project_updates")
    .insert([
      {
        project_id: id,
        account_id: accountId,
        created_by: user.id,
        title,
        body: b || null,
        client_visible,
      },
    ])
    .select("id, project_id, account_id, created_by, created_at, title, body, client_visible")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach author_name in response
  const authorRes = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .eq("account_id", accountId)
    .maybeSingle();

  const author_name = !authorRes.error && authorRes.data ? (authorRes.data as any).full_name || null : null;

  return NextResponse.json({ ok: true, update: { ...(data as any), author_name } }, { status: 200 });
}
