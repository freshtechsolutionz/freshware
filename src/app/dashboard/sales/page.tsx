import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SalesPipelineBoard from "@/components/SalesPipelineBoard";

export default async function SalesPage() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user) {
    redirect("/login?next=/dashboard/sales");
  }

  const { data: profileRes, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr) redirect("/dashboard");

  const role = profileRes?.role ?? "PENDING";
  const allowed = ["CEO", "ADMIN", "STAFF"];
  if (!allowed.includes(role)) redirect("/dashboard");

  const { data: opportunities, error } = await supabase
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

  return <SalesPipelineBoard opportunities={opportunities ?? []} />;
}
