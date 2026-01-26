// src/app/api/opportunities/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only Supabase client (uses Service Role key)
const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, stage, serviceLine, amount } = body;

    // Basic validation
    if (!name || !stage || !serviceLine) {
      return NextResponse.json(
        { error: "Missing required fields: name, stage, serviceLine" },
        { status: 400 }
      );
    }

    // Insert into opportunities table
    const { data, error } = await supabase
      .from("opportunities")
      .insert([
        {
          name,
          stage,
          service_line: serviceLine, // DB column is snake_case
          amount: typeof amount === "number" ? amount : Number(amount) || 0,
        },
      ])
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
