import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Payload = {
  event?: string;
  external_id?: string;
  contact_name?: string;
  contact_email?: string;
  start_iso?: string;
  end_iso?: string;
};

export async function POST(
  req: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await context.params;

    // Connect to Supabase (admin)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Look up this account's integration + secret
    const { data: integration, error: integErr } = await supabase
      .from("account_integrations")
      .select("webhook_secret,status")
      .eq("account_id", accountId)
      .eq("provider", "youcanbookme")
      .maybeSingle();

    if (integErr) {
      return NextResponse.json({ error: integErr.message }, { status: 500 });
    }
    if (!integration || integration.status !== "connected") {
      return NextResponse.json({ error: "Integration not connected" }, { status: 404 });
    }

    // 2) Verify secret (per-account)
    const secret = req.headers.get("x-ycbm-secret");
    if (!secret || secret !== integration.webhook_secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3) Read incoming data
    const body = (await req.json()) as Payload;

    const { event, external_id, contact_name, contact_email, start_iso } = body;

    if (!external_id || !start_iso) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 4) Upsert meeting under the correct account
    const { error } = await supabase
      .from("meetings")
      .upsert(
        {
          external_id,
          account_id: accountId,
          contact_name: contact_name || null,
          contact_email: contact_email || null,
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
