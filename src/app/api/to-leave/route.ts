import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("to_leave_items")
    .select("id, title, completed, completed_at, created_at, updated_at")
    .eq("account_id", profile.account_id)
    .eq("owner_user_id", user.id)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const title = body?.title ? String(body.title).trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("to_leave_items")
    .insert({
      account_id: profile.account_id,
      owner_user_id: user.id,
      title,
      completed: false,
      completed_at: null,
    })
    .select("id, title, completed, completed_at, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data }, { status: 201 });
}