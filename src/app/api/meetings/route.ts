import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { contact_name, contact_email, scheduled_at, status, source } = body;

    if (!scheduled_at) {
      return NextResponse.json({ error: "Missing required field: scheduled_at" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meetings")
      .insert([
        {
          contact_name: contact_name || null,
          contact_email: contact_email || null,
          scheduled_at, // ISO string recommended
          status: status || "scheduled",
          source: source || "manual",
        },
      ])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ meeting: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
