import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // 1. Check the secret
    const secret = req.headers.get("x-ycbm-secret");
    if (secret !== process.env.YCBM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Read incoming data
    const body = await req.json();

    const {
      event,
      external_id,
      contact_name,
      contact_email,
      start_iso,
      end_iso,
    } = body;

    if (!external_id || !start_iso) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 3. Connect to Supabase (admin)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. Save meeting
    const { error } = await supabase
      .from("meetings")
      .upsert(
        {
          external_id,
          contact_name,
          contact_email,
          scheduled_at: start_iso,
          status: event === "booking_cancelled" ? "canceled" : "scheduled",
          source: "youcanbookme",
        },
        { onConflict: "external_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
