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
  return NextResponse.json({ ok: true, route: "email-summary" }, { status: 200 });
}

/**
 * POST /api/integrations/ycbm/email-summary/[accountId]
 *
 * Accepts either:
 * - external_id (preferred when you have it), OR
 * - contact_email (for Zoom meeting assets emails)
 */
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

    if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const external_id =
      typeof (body as any).external_id === "string" ? (body as any).external_id.trim() : "";

    const contact_email =
      typeof (body as any).contact_email === "string"
        ? (body as any).contact_email.trim().toLowerCase()
        : "";

    const summary =
      typeof (body as any).summary === "string" ? (body as any).summary.trim() : "";

    const meeting_link =
      typeof (body as any).meeting_link === "string" ? (body as any).meeting_link.trim() : "";

    const notes =
      typeof (body as any).notes === "string" ? (body as any).notes.trim() : "";

    // optional trace payload
    const raw = (body as any).raw;

    if (!accountId) {
      return NextResponse.json({ ok: false, error: "Missing accountId in route" }, { status: 400 });
    }

    // ✅ Key change: allow either external_id OR contact_email
    if (!external_id && !contact_email) {
      return NextResponse.json(
        { ok: false, error: "Provide external_id or contact_email" },
        { status: 400 }
      );
    }

    // Build update payload (only include provided fields)
    const updatePayload: Record<string, any> = {};
    if (summary) updatePayload.meeting_summary = summary;
    if (meeting_link) updatePayload.meeting_link = meeting_link;
    if (notes) updatePayload.notes = notes;
    if (raw && typeof raw === "object") updatePayload.raw = raw;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    // 1) If external_id is provided, attempt that first
    if (external_id) {
      const direct = await supabase
        .from("meetings")
        .update(updatePayload)
        .eq("account_id", accountId)
        .eq("external_id", external_id)
        .select("id")
        .maybeSingle();

      if (direct.error) {
        // retry without raw if raw column missing
        const msg = (direct.error.message || "").toLowerCase();
        if (msg.includes("column") && msg.includes("raw")) {
          delete updatePayload.raw;
          const retry = await supabase
            .from("meetings")
            .update(updatePayload)
            .eq("account_id", accountId)
            .eq("external_id", external_id)
            .select("id")
            .maybeSingle();

          if (retry.error) {
            return NextResponse.json({ ok: false, error: retry.error.message }, { status: 500 });
          }

          if (!retry.data?.id) {
            return NextResponse.json({ ok: false, error: "Meeting not found" }, { status: 404 });
          }

          return NextResponse.json(
            { ok: true, updated: true, meeting_id: retry.data.id, matched_by: "external_id" },
            { status: 200 }
          );
        }

        return NextResponse.json({ ok: false, error: direct.error.message }, { status: 500 });
      }

      if (direct.data?.id) {
        return NextResponse.json(
          { ok: true, updated: true, meeting_id: direct.data.id, matched_by: "external_id" },
          { status: 200 }
        );
      }
      // If not found, fall through to contact_email matching
    }

    // 2) Match by contact_email (for Zoom meeting assets emails)
    if (contact_email) {
      // Find the most recent meeting for this contact in last 30 days (safer window)
      const daysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const lookup = await supabase
        .from("meetings")
        .select("id, external_id, scheduled_at, created_at")
        .eq("account_id", accountId)
        .eq("contact_email", contact_email)
        .gte("created_at", daysAgo)
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookup.error) {
        return NextResponse.json({ ok: false, error: lookup.error.message }, { status: 500 });
      }

      if (!lookup.data?.id) {
        return NextResponse.json(
          { ok: false, error: "No recent meeting found for contact_email", contact_email },
          { status: 404 }
        );
      }

      const update = await supabase
        .from("meetings")
        .update(updatePayload)
        .eq("id", lookup.data.id)
        .select("id")
        .maybeSingle();

      if (update.error) {
        const msg = (update.error.message || "").toLowerCase();
        if (msg.includes("column") && msg.includes("raw")) {
          delete updatePayload.raw;
          const retry = await supabase
            .from("meetings")
            .update(updatePayload)
            .eq("id", lookup.data.id)
            .select("id")
            .maybeSingle();

          if (retry.error) {
            return NextResponse.json({ ok: false, error: retry.error.message }, { status: 500 });
          }

          return NextResponse.json(
            { ok: true, updated: true, meeting_id: retry.data?.id, matched_by: "contact_email", contact_email },
            { status: 200 }
          );
        }

        return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });
      }

      return NextResponse.json(
        { ok: true, updated: true, meeting_id: update.data?.id, matched_by: "contact_email", contact_email },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: false, error: "Unable to match meeting" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}