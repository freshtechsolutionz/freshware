import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const opportunity_id = body?.opportunity_id ? String(body.opportunity_id) : "";

    if (!opportunity_id) {
      return NextResponse.json({ error: "Missing opportunity_id" }, { status: 400 });
    }

    if (!profile.account_id) {
      return NextResponse.json(
        { error: "Your profile is missing account_id. Assign your user to an account first." },
        { status: 400 }
      );
    }

    // Load opportunity (scoped to account)
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .select("id,name,stage,account_id,owner_user_id,contact_id,service_line,amount")
      .eq("id", opportunity_id)
      .eq("account_id", profile.account_id)
      .single();

    if (oppErr || !opp) {
      return NextResponse.json({ error: oppErr?.message || "Opportunity not found" }, { status: 404 });
    }

    if (String(opp.stage || "").toLowerCase() !== "won") {
      return NextResponse.json({ error: "Opportunity must be in WON status to convert." }, { status: 400 });
    }

    // Prevent duplicates: check for existing project
    const { data: existing, error: existErr } = await supabase
      .from("projects")
      .select("id")
      .eq("opportunity_id", opp.id)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    if (existing?.id) {
      return NextResponse.json({ ok: true, project_id: existing.id, already_existed: true }, { status: 200 });
    }

    // Create project (aligns to your projects columns)
    const insertRow: any = {
      opportunity_id: opp.id,
      name: opp.name || "New Project",
      status: "active",
      owner_user_id: user.id,
      account_id: profile.account_id,
      created_by: user.id,
      // start_date/due_date/health/stage/description/internal_notes are optional
    };

    const { data: created, error: createErr } = await supabase
      .from("projects")
      .insert(insertRow)
      .select("id")
      .single();

    if (createErr || !created) {
      return NextResponse.json({ error: createErr?.message || "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, project_id: created.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}