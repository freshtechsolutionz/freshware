import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = profile.role ?? "PENDING";
  if (!isStaff(role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;
  if (!accountId) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });

  const payload = {
    account_id: accountId,
    opportunity_id: body?.opportunity_id ? String(body.opportunity_id) : null,
    name,
    status: body?.status ? String(body.status) : "active",
    start_date: body?.start_date ? String(body.start_date) : null,
    due_date: body?.due_date ? String(body.due_date) : null,
    health: body?.health ? String(body.health) : "Green",
    description: body?.description ? String(body.description) : null,
    internal_notes: body?.internal_notes ? String(body.internal_notes) : null,
    owner_user_id: profile.id,
    created_by: user.id,
  };

  const { data, error } = await supabase.from("projects").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data }, { status: 200 });
}
