import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only Supabase client (Service Role)
const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const { name, stage, serviceLine, amount } = body;

    // Basic validation
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (!name || !stage || !serviceLine) {
      return NextResponse.json(
        { error: "Missing required fields: name, stage, serviceLine" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opportunities")
      .update({
        name,
        stage,
        service_line: serviceLine,
        amount: typeof amount === "number" ? amount : Number(amount) || 0,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ opportunity: data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
