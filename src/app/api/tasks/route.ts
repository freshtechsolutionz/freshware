import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const title = (body?.title || "").toString().trim();
  if (!title) {
    return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
  }

  const status = body?.status ? String(body.status).trim() : "open";
  const description = body?.description ? String(body.description).trim() : null;
  const due_at = body?.due_at ? new Date(body.due_at).toISOString() : null;
  const opportunity_id = body?.opportunity_id ? String(body.opportunity_id) : null;
  const assigned_to = body?.assigned_to ? String(body.assigned_to) : null;

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  const account_id =
    isAdmin && body?.account_id ? String(body.account_id) : profile.account_id;

  if (!account_id) {
    return NextResponse.json({ error: "No account_id available for this user" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        title,
        description,
        status,
        due_at,
        opportunity_id,
        assigned_to,
        account_id,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 200 });
}
