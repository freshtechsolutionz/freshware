import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


export async function GET() {
  return NextResponse.json({ ok: true, route: "email-summary" }, { status: 200 });
}

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await context.params;

    // 1) Verify secret (global shared secret)
    const incoming = req.headers.get("x-freshware-secret") || "";
    const expected = mustEnv("FRESHWARE_WEBHOOK_SECRET");
    if (incoming !== expected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) Read body
    const body = (await req.json()) as {
      external_id?: string;
      booking_id?: string;
      booking_ref?: string;
      summary?: string;
      meeting_summary?: string;
      notes?: string;
      zoom_link?: string;
      meeting_link?: string;
    };

    const externalId =
      (body.external_id || body.booking_id || body.booking_ref || "").trim();
    const summary =
      (body.summary || body.meeting_summary || "").trim() || null;
    const meetingLink = (body.zoom_link || body.meeting_link || "").trim() || null;
    const notes = (body.notes || "").trim() || null;

    if (!externalId) {
      return NextResponse.json(
        { error: "external_id (or booking_id / booking_ref) required" },
        { status: 400 }
      );
    }

    // 3) Admin Supabase client
    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 4) Update meeting by external_id + account_id
    //    (we store summary into meetings.description for now,
    //     and meetingLink into booking_page if you want a link visible immediately)
    const { data: updated, error: upErr } = await supabase
      .from("meetings")
      .update({
        description: summary,          // "Meeting Summary" for now
        booking_page: meetingLink,     // store link here for now
        // You can also store notes into raw or add a notes column later
        raw: {
          ...(typeof body === "object" ? body : {}),
          meeting_notes: notes,
        },
      })
      .eq("account_id", accountId)
      .eq("external_id", externalId)
      .select("id")
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    if (!updated?.id) {
      return NextResponse.json(
        { ok: false, match: "none", error: "No meeting found for external_id + account_id" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, match: "external_id", meeting_id: updated.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}