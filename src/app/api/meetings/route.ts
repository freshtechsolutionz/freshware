import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun
  const mondayDelta = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + mondayDelta);
  return d.toISOString();
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, n));
  return d.toISOString();
}

export async function GET(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "").toLowerCase(); // today | week | 7 | 30
  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";

  const account_id = isAdmin && url.searchParams.get("account_id")
    ? String(url.searchParams.get("account_id"))
    : profile.account_id;

  if (!account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

  let since: string | null = null;
  if (range === "today") since = startOfTodayIso();
  else if (range === "week") since = startOfWeekIso();
  else if (range === "7") since = daysAgoIso(6);
  else if (range === "30") since = daysAgoIso(29);

  let q = supabase
    .from("meetings")
    .select("id,external_id,contact_email,contact_name,scheduled_at,status,source,created_at,account_id,created_by,description,opportunity_id")
    .eq("account_id", account_id)
    .order("scheduled_at", { ascending: false });

  if (since) q = q.gte("scheduled_at", since);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meetings: data || [], range: range || null }, { status: 200 });
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const contact_name = body?.contact_name ? String(body.contact_name).trim() : null;
  const contact_email = body?.contact_email ? String(body.contact_email).trim() : null;
  const scheduled_at = body?.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;
  const description = body?.description ? String(body.description).trim() : null;

  if (!scheduled_at) {
    return NextResponse.json({ error: "Missing required field: scheduled_at" }, { status: 400 });
  }

  const isAdmin = profile.role === "CEO" || profile.role === "ADMIN";
  const account_id =
    isAdmin && body?.account_id ? String(body.account_id) : profile.account_id;

  if (!account_id) return NextResponse.json({ error: "No account_id available for this user" }, { status: 400 });

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
        description,
        created_by: user.id,
      },
    ])
    .select("id,external_id,contact_email,contact_name,scheduled_at,status,source,created_at,account_id,created_by,description,opportunity_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meeting: data }, { status: 200 });
}
