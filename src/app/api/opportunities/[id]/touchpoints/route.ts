// src/app/api/opportunities/[id]/touchpoints/route.ts
import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: opportunity_id } = await context.params;

  // Confirm opp exists (RLS should already scope by account, but we return a friendly error)
  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .select("id")
    .eq("id", opportunity_id)
    .maybeSingle();

  if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("opportunity_touchpoints")
    .select("id, opportunity_id, touchpoint_type, occurred_at, notes, created_at, created_by")
    .eq("opportunity_id", opportunity_id)
    .order("occurred_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ touchpoints: data || [] }, { status: 200 });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: opportunity_id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const touchpoint_type = (body?.touchpoint_type || "note").toString().trim().toLowerCase();
  const notes = body?.notes != null ? String(body.notes).trim() : null;
  const occurred_at = body?.occurred_at ? new Date(body.occurred_at).toISOString() : new Date().toISOString();

  // Keep types flexible, but prevent empty
  if (!touchpoint_type) {
    return NextResponse.json({ error: "touchpoint_type is required" }, { status: 400 });
  }

  // Confirm opp exists
  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .select("id")
    .eq("id", opportunity_id)
    .maybeSingle();

  if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("opportunity_touchpoints")
    .insert([
      {
        opportunity_id,
        touchpoint_type,
        notes,
        occurred_at,
      },
    ])
    .select("id, opportunity_id, touchpoint_type, occurred_at, notes, created_at, created_by")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional: bump opp last_activity_at for “momentum”
  await supabase
    .from("opportunities")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", opportunity_id);

  return NextResponse.json({ touchpoint: data }, { status: 200 });
}