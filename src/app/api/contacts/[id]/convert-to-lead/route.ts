import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type BlinqPayload = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
  source_ref?: string;
  [k: string]: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-freshware-secret") || "";
    if (secret !== mustEnv("FRESHWARE_WEBHOOK_SECRET")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const blinqKey = (url.searchParams.get("key") || "").trim();
    if (!blinqKey) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const body = (await req.json()) as BlinqPayload;

    const email = (body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Find owner (staff) by blinq_key
    const { data: owner, error: ownerErr } = await supabase
      .from("profiles")
      .select("id, account_id")
      .eq("blinq_key", blinqKey)
      .maybeSingle();

    if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 400 });
    if (!owner?.account_id) return NextResponse.json({ error: "Owner missing account_id" }, { status: 400 });

    const accountId = owner.account_id as string;
    const ownerProfileId = owner.id as string;

    // Upsert contact by (account_id + email)
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .maybeSingle();

    const payload = {
      account_id: accountId,
      email,
      first_name: (body.first_name || "").trim() || null,
      last_name: (body.last_name || "").trim() || null,
      phone: (body.phone || "").trim() || null,
      company: (body.company || "").trim() || null,
      title: (body.title || "").trim() || null,
      notes: (body.notes || "").trim() || null,
      source: "blinq",
      source_ref: body.source_ref || null,
      imported_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      owner_profile_id: ownerProfileId,
    };

    let contactId: string;

    if (!existing?.id) {
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert(payload)
        .select("id")
        .single();

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      contactId = inserted.id;
    } else {
      contactId = existing.id;
      await supabase.from("contacts").update(payload).eq("id", contactId);
    }

    return NextResponse.json({ ok: true, contact_id: contactId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
