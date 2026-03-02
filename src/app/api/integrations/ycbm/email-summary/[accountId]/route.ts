import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WEBHOOK_SECRET = process.env.FRESHWARE_WEBHOOK_SECRET || "";

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "email-summary",
      env: {
        hasUrl: !!SUPABASE_URL,
        hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
        hasSecret: !!WEBHOOK_SECRET,
      },
    },
    { status: 200 }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await context.params;

    const providedSecret =
      req.headers.get("x-freshware-secret") ||
      req.headers.get("X-Freshware-Secret") ||
      "";

    if (!WEBHOOK_SECRET) {
      console.error("[email-summary] Missing FRESHWARE_WEBHOOK_SECRET");
      return NextResponse.json({ ok: false, error: "Server missing secret" }, { status: 500 });
    }

    if (providedSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[email-summary] Missing Supabase env", {
        hasUrl: !!SUPABASE_URL,
        hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return NextResponse.json(
        { ok: false, error: "Server missing Supabase env vars" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const external_id = typeof (body as any).external_id === "string" ? (body as any).external_id.trim() : "";
    const summary = typeof (body as any).summary === "string" ? (body as any).summary.trim() : "";
    const meeting_link = typeof (body as any).meeting_link === "string" ? (body as any).meeting_link.trim() : "";
    const notes = typeof (body as any).notes === "string" ? (body as any).notes.trim() : "";

    if (!accountId) {
      return NextResponse.json({ ok: false, error: "Missing accountId in route" }, { status: 400 });
    }
    if (!external_id) {
      return NextResponse.json({ ok: false, error: "Missing required field: external_id" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // ✅ Minimal update first (to avoid schema mismatch)
    const updatePayload: Record<string, any> = {
      // these are safe if column exists; if not, Supabase will tell us
      meeting_summary: summary || null,
      meeting_link: meeting_link || null,
      notes: notes || null,
    };

    const { data, error } = await supabase
      .from("meetings")
      .update(updatePayload)
      .eq("account_id", accountId)
      .eq("external_id", external_id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[email-summary] Supabase update error", {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
      // return sanitized message so you can fix it quickly
      return NextResponse.json(
        { ok: false, error: error.message, code: (error as any).code ?? null },
        { status: 500 }
      );
    }

    if (!data?.id) {
      return NextResponse.json(
        { ok: false, error: "Meeting not found for account + external_id", accountId, external_id },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, updated: true, meeting_id: data.id }, { status: 200 });
  } catch (e: any) {
    console.error("[email-summary] Unhandled error", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}