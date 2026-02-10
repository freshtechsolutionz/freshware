import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query Postgres catalog via RPC-free approach:
  // We use a safe select against information_schema (requires RLS off there; usually accessible).
  // If this ever fails in your environment, we’ll switch to a SQL RPC function.
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "tasks");

  if (error) {
    // Fallback: minimal known columns
    return NextResponse.json({
      columns: ["task_id", "id", "opportunity_id", "title"],
      fallback: true,
      error: error.message,
    });
  }

  const columns = (data || []).map((r: any) => r.column_name);
  return NextResponse.json({ columns });
}
