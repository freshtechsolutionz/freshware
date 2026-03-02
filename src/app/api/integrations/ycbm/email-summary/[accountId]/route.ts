import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Env
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.FRESHWARE_WEBHOOK_SECRET!;

/**
 * IMPORTANT:
 * This endpoint is meant for Zapier (server-to-server) so we use service role.
 * Keep it protected with the shared secret header.
 */
function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * GET ping - helpful for verifying deployment quickly
 */
export async function GET() {
  return NextResponse.json({ ok: true, route: "email-summary" }, { status: 200 });
}

/**
 * POST /api/integrations/ycbm/email-summary/[accountId]
 *
 * Headers:
 *  x-freshware-secret: <FRESHWARE_WEBHOOK_SECRET>
 *
 * Body (JSON):
 *  {
 *    "external_id": "YCBM_BOOKING_ID_OR_EXTERNAL_ID",
 *    "summary": "Meeting summary text",
 *    "meeting_link": "https://zoom.us/j/....",
 *    "notes": "Optional extra notes",
 *    "raw": { ...optional raw payload ... }
 *  }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    // ✅ Next 16: params is a Promise
    const { accountId } = await context.params;

    // ✅ Secret validation
    const providedSecret =
      req.headers.get("x-freshware-secret") ||
      req.headers.get("X-Freshware-Secret") ||
      "";

    if (!WEBHOOK_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: missing FRESHWARE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }

    if (providedSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Parse JSON body
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const external_id =
      typeof (body as any).external_id === "string" ? (body as any).external_id.trim() : "";

    const summary =
      typeof (body as any).summary === "string" ? (body as any).summary.trim() : "";

    const meeting_link =
      typeof (body as any).meeting_link === "string" ? (body as any).meeting_link.trim() : "";

    const notes =
      typeof (body as any).notes === "string" ? (body as any).notes.trim() : "";

    const raw = (body as any).raw ?? body; // default raw to body for traceability

    if (!accountId) {
      return NextResponse.json({ ok: false, error: "Missing accountId in route" }, { status: 400 });
    }

    if (!external_id) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: external_id" },
        { status: 400 }
      );
    }

    // ✅ Update meeting
    const supabase = supabaseAdmin();

    // Build update payload safely (only include non-empty fields)
    // NOTE: These column names must exist in your `meetings` table.
    const updatePayload: Record<string, any> = {};

    // If your schema uses different column names, tell me and I’ll align it.
    if (summary) updatePayload.meeting_summary = summary;
    if (meeting_link) updatePayload.meeting_link = meeting_link;
    if (notes) updatePayload.notes = notes;

    // Optional: store raw payload if you have a jsonb column like `raw`
    // If you don't have it, leaving it in won't break the request if we only set it when column exists.
    // But Supabase will error if column doesn't exist — so we'll only attempt it when explicitly provided.
    if (raw && typeof raw === "object") {
      updatePayload.raw = raw;
    }

    // Always stamp updated time fields if you have them (optional)
    updatePayload.updated_at = new Date().toISOString();

    // 1) Try update with raw included (if present)
    let updateRes = await supabase
      .from("meetings")
      .update(updatePayload)
      .eq("account_id", accountId)
      .eq("external_id", external_id)
      .select("id")
      .maybeSingle();

    // If it failed due to missing `raw` column, retry without raw
    if (updateRes.error && String(updateRes.error.message || "").toLowerCase().includes("column") &&
        String(updateRes.error.message || "").toLowerCase().includes("raw")) {
      delete updatePayload.raw;

      updateRes = await supabase
        .from("meetings")
        .update(updatePayload)
        .eq("account_id", accountId)
        .eq("external_id", external_id)
        .select("id")
        .maybeSingle();
    }

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, error: updateRes.error.message ?? updateRes.error },
        { status: 500 }
      );
    }

    if (!updateRes.data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Meeting not found for this account + external_id",
          accountId,
          external_id,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        updated: true,
        meeting_id: updateRes.data.id,
        accountId,
        external_id,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}