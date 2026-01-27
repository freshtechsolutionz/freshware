import { supabaseServer } from "@/lib/supabase/server";
import SalesPipelineBoard from "@/components/SalesPipelineBoard";

export default async function SalesPage() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes?.user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Sales Pipeline</h2>
        <pre style={{ color: "crimson" }}>
          {JSON.stringify({ userErr: userErr?.message, user: userRes?.user }, null, 2)}
        </pre>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select("id, name, stage, service_line, amount, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Sales Pipeline</h2>
        <p style={{ color: "crimson" }}>Error: {error.message}</p>
      </div>
    );
  }

  return <SalesPipelineBoard opportunities={data || []} />;
}
