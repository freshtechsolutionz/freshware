import { supabaseServer } from "@/lib/supabase/server";
import SalesPipelineBoard from "@/components/SalesPipelineBoard";

export default async function SalesPage() {
  const supabase = await supabaseServer(); // ✅ NOTE: await

  // auth check
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  // ✅ TEMP DEBUG so you never get a blank white page
  if (userErr || !userRes?.user) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Sales Pipeline</h2>
        <p style={{ color: "crimson" }}>Not authenticated on server.</p>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(
            { userErr: userErr?.message ?? null, user: userRes?.user ?? null },
            null,
            2
          )}
        </pre>
        <p style={{ marginTop: 12 }}>
          Go to <b>/login</b>, sign in, then refresh this page.
        </p>
      </div>
    );
  }

  // Pull opportunities
  const { data, error } = await supabase
    .from("opportunities")
    .select("id, name, stage, service_line, amount, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Sales Pipeline</h2>
        <p style={{ color: "crimson" }}>DB Error: {error.message}</p>
      </div>
    );
  }

  return <SalesPipelineBoard opportunities={data || []} />;
}
