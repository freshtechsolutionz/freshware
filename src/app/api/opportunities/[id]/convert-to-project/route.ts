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
    if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const roleUpper = String(profile.role || "").toUpperCase();
    const canConvert = ["CEO", "ADMIN", "SALES", "OPS"].includes(roleUpper);
    if (!canConvert) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const { id } = await context.params;

    const admin = createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"));

    // 1) Mark as won (your DB trigger will create the project)
    const { data: opp, error: oppErr } = await admin
      .from("opportunities")
      .update({ stage: "won", last_activity_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, account_id")
      .single();

    if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 400 });

    // 2) Find the created project (best-effort)
    const { data: proj } = await admin
      .from("projects")
      .select("id")
      .eq("account_id", opp.account_id)
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .maybeSingle();

    return NextResponse.json({ ok: true, opportunity_id: id, project_id: proj?.id ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
