import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const proj = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (proj.error) return NextResponse.json({ error: proj.error.message }, { status: 500 });
  if (!proj.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("project_team_members")
    .select("id, account_id, project_id, member_user_id, role, created_at")
    .eq("account_id", accountId)
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const memberIds = Array.from(new Set((data || []).map((x: any) => x.member_user_id).filter(Boolean))) as string[];
  const nameMap: Record<string, string> = {};

  if (memberIds.length) {
    const res = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds)
      .eq("account_id", accountId);

    if (!res.error) {
      for (const p of (res.data || []) as any[]) nameMap[p.id] = p.full_name || p.id;
    }
  }

  const team = (data || []).map((m: any) => ({
    ...m,
    member_name: nameMap[m.member_user_id] || null,
  }));

  return NextResponse.json({ team }, { status: 200 });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const proj = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (proj.error) return NextResponse.json({ error: proj.error.message }, { status: 500 });
  if (!proj.data) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const member_user_id = body?.member_user_id ? String(body.member_user_id) : null;
  if (!member_user_id) return NextResponse.json({ error: "Missing member_user_id" }, { status: 400 });

  const role = body?.role ? String(body.role).trim() : null;

  const { data, error } = await supabase
    .from("project_team_members")
    .insert({
      account_id: accountId,
      project_id: id,
      member_user_id,
      role,
    })
    .select("id, account_id, project_id, member_user_id, role, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ member: data }, { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const role = (profile.role || "").toUpperCase();
  const canDelete = role === "CEO" || role === "ADMIN" || role === "OPS";
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const memberId = body?.id ? String(body.id) : null;
  if (!memberId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("project_team_members")
    .delete()
    .eq("id", memberId)
    .eq("account_id", accountId)
    .eq("project_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
