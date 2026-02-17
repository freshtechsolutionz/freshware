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
    .from("project_milestones")
    .select("id, account_id, project_id, title, description, due_at, status, created_at")
    .eq("account_id", accountId)
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ milestones: data || [] }, { status: 200 });
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
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const description =
    body?.description === null || body?.description === undefined
      ? null
      : String(body.description).trim() || null;

  const due_at = body?.due_at ? new Date(body.due_at).toISOString() : null;
  const status = body?.status ? String(body.status).trim() : "Planned";

  const { data, error } = await supabase
    .from("project_milestones")
    .insert({
      account_id: accountId,
      project_id: id,
      title,
      description,
      due_at,
      status,
    })
    .select("id, account_id, project_id, title, description, due_at, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ milestone: data }, { status: 200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const milestoneId = body?.id ? String(body.id) : null;
  if (!milestoneId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const patch: any = {};
  if ("title" in body) patch.title = body.title ? String(body.title).trim() : null;
  if ("description" in body) patch.description = body.description ? String(body.description).trim() : null;
  if ("due_at" in body) patch.due_at = body.due_at ? new Date(body.due_at).toISOString() : null;
  if ("status" in body) patch.status = body.status ? String(body.status).trim() : null;

  const { data, error } = await supabase
    .from("project_milestones")
    .update(patch)
    .eq("id", milestoneId)
    .eq("account_id", accountId)
    .eq("project_id", id)
    .select("id, account_id, project_id, title, description, due_at, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ milestone: data }, { status: 200 });
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
  const milestoneId = body?.id ? String(body.id) : null;
  if (!milestoneId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("account_id", accountId)
    .eq("project_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
