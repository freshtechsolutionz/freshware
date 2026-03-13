import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireViewer();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!profile || profile.role === "PENDING") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roleUpper = String(profile.role || "").toUpperCase();
    const canConvert = ["CEO", "ADMIN", "SALES", "OPS"].includes(roleUpper);
    if (!canConvert) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { id } = await context.params;

    const admin = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Load the opportunity first
    const { data: opp, error: oppErr } = await admin
      .from("opportunities")
      .select("id, name, account_id, owner_user_id, contact_id, stage")
      .eq("id", id)
      .single();

    if (oppErr || !opp) {
      return NextResponse.json({ error: oppErr?.message || "Opportunity not found" }, { status: 404 });
    }

    if (!opp.account_id) {
      return NextResponse.json({ error: "Opportunity is missing account_id" }, { status: 400 });
    }

    // Prevent duplicates
    const { data: existing, error: existingErr } = await admin
      .from("projects")
      .select("id")
      .eq("opportunity_id", id)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    // Always make sure the opportunity is marked won
    const { error: wonErr } = await admin
      .from("opportunities")
      .update({
        stage: "won",
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (wonErr) {
      return NextResponse.json({ error: wonErr.message }, { status: 400 });
    }

    if (existing?.id) {
      return NextResponse.json(
        {
          ok: true,
          already_existed: true,
          opportunity_id: id,
          project_id: existing.id,
        },
        { status: 200 }
      );
    }

    // Create the project explicitly (do not rely on trigger)
    const insertRow = {
      opportunity_id: opp.id,
      name: opp.name || "New Project",
      status: "active",
      owner_user_id: opp.owner_user_id || user.id,
      account_id: opp.account_id,
      created_by: user.id,
      description: null,
      internal_notes: null,
      health: null,
      start_date: null,
      due_date: null,
      stage: null,
    };

    const { data: project, error: createErr } = await admin
      .from("projects")
      .insert(insertRow)
      .select("id, name, opportunity_id, account_id, status, created_at")
      .single();

    if (createErr || !project) {
      return NextResponse.json(
        { error: createErr?.message || "Failed to create project" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        opportunity_id: id,
        project_id: project.id,
        project,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}