import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!profile || !profile.account_id) {
    return NextResponse.json({ error: "User profile missing account_id." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const name = String(body?.name || "").trim();
  const status = String(body?.status || "Active").trim();

  // Optional fields (your table supports them)
  const start_date = body?.start_date ? String(body.start_date) : null; // expects YYYY-MM-DD
  const due_date = body?.due_date ? String(body.due_date) : null; // expects YYYY-MM-DD
  const health = body?.health ? String(body.health) : "Good";

  if (!name) {
    return NextResponse.json({ error: "Missing project name." }, { status: 400 });
  }

  const insertRow: any = {
    name,
    status,
    account_id: profile.account_id,
    owner_user_id: user.id, // matches your schema
    start_date,
    due_date,
    health,
  };

  // Only include created_by if the column exists (after you add it)
  // If you run the SQL above, this will work immediately.
  insertRow.created_by = user.id;

  const { data, error } = await supabase
    .from("projects")
    .insert([insertRow])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data }, { status: 200 });
}
