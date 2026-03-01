import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // keeps it stable on Vercel

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/meetings/[id]/notes
 * Body: { notes: string }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const body = await req.json().catch(() => ({}));
    const notes = typeof body?.notes === "string" ? body.notes : "";

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing meeting id" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { error } = await supabase
      .from("meetings")
      .update({ notes })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? error }, { status: 500 });
  }
}