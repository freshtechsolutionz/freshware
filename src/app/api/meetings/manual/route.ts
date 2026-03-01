import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Body = {
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  scheduled_at_local: string; // "YYYY-MM-DDTHH:mm"
  meeting_link: string | null;
  meeting_summary: string | null;
};

function toIsoFromLocal(local: string) {
  // datetime-local comes without timezone; interpret as local browser time when entered.
  // We store as ISO (UTC). This is acceptable for sorting; UI renders in CT.
  const d = new Date(local);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as Body;

    const scheduled_at = toIsoFromLocal(body.scheduled_at_local);
    if (!scheduled_at) return NextResponse.json({ error: "Invalid scheduled_at" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (!profile?.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });

    const contact_email = (body.contact_email || "").trim().toLowerCase() || null;
    const contact_name = (body.contact_name || "").trim() || (contact_email ?? "Unknown");
    const phone = (body.phone || "").trim() || null;

    // Upsert contact if email provided
    let contact_id: string | null = null;

    if (contact_email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("account_id", profile.account_id)
        .ilike("email", contact_email)
        .maybeSingle();

      if (!existing?.id) {
        const { data: inserted, error: insErr } = await supabase
          .from("contacts")
          .insert({
            account_id: profile.account_id,
            name: contact_name,
            email: contact_email,
            phone,
            source: "manual",
            imported_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
        contact_id = inserted.id;
      } else {
        contact_id = existing.id;
        await supabase
          .from("contacts")
          .update({
            name: contact_name,
            phone,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", contact_id);
      }
    }

    // Insert meeting (Rule A trigger will link opportunity_id automatically if possible)
    const { error: mErr } = await supabase.from("meetings").insert({
      account_id: profile.account_id,
      contact_name,
      contact_email,
      scheduled_at,
      start_at: scheduled_at,
      status: "scheduled",
      source: "manual",
      description: body.meeting_summary || null,
      meeting_summary: body.meeting_summary || null,
      meeting_link: (body.meeting_link || "").trim() || null,
      contact_id,
    });

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}