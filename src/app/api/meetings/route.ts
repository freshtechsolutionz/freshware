import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function GET() {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meetings: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const contact_name = body?.contact_name ? String(body.contact_name).trim() : null;
  const contact_email = body?.contact_email ? String(body.contact_email).trim() : null;
  const scheduled_at = body?.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;

  if (!scheduled_at) {
    return NextResponse.json({ error: "Missing required field: scheduled_at" }, { status: 400 });
  }

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  const account_id =
    isAdmin && body?.account_id ? String(body.account_id) : profile.account_id;

  if (!account_id) {
    return NextResponse.json({ error: "No account_id available for this user" }, { status: 400 });
  }

  const status = body?.status ? String(body.status).trim() : "scheduled";
  const source = body?.source ? String(body.source).trim() : "manual";
  const external_id = body?.external_id ? String(body.external_id) : null;
  const opportunity_id = body?.opportunity_id ? String(body.opportunity_id) : null;

  const { data, error } = await supabase
    .from("meetings")
    .insert([
      {
        account_id,
        contact_name,
        contact_email,
        scheduled_at,
        status,
        source,
        external_id,
        opportunity_id,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meeting: data }, { status: 200 });
}
