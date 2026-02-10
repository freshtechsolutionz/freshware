import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // RLS will scope for non-admin automatically
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ accounts: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Only CEO/ADMIN can create accounts." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body?.name || "").toString().trim();
  const industry = body?.industry ? String(body.industry).trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert([{ name, industry }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ account: data }, { status: 200 });
}
