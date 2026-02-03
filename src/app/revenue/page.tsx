"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };

type RevenueRow = {
  id: string;
  // add your actual columns here if different; listing all columns safely using select("*") is fine for v1
  created_at: string;
};

export default function RevenuePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const role = profile?.role ?? "PENDING";

  const canView = useMemo(() => ["CEO", "ADMIN"].includes(role), [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/revenue");
      return;
    }

    const { data: p, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, account_id")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setError(profErr.message);
      setLoading(false);
      return;
    }

    setProfile(p);
    setLoading(false);
  }

  async function loadRows() {
    setRowsError(null);

    const { data, error } = await supabase
      .from("revenue_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      return;
    }

    setRows(data ?? []);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (canView) loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <main style={{ padding: 24 }}>Loading revenue…</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Revenue Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  if (!canView) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Revenue</h1>
        <p style={{ color: "crimson" }}>Access denied. (CEO/Admin only)</p>
        <button onClick={() => router.push("/dashboard")}>← Dashboard</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Revenue</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/dashboard")}>← Dashboard</button>{" "}
        <button onClick={logout}>Log out</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd" }}>
        <b>Role:</b> {role} <br />
        <b>Account:</b> {profile?.account_id ?? "(none)"}
      </div>

      {rowsError && <p style={{ color: "crimson" }}>{rowsError}</p>}

      <div style={{ marginTop: 20 }}>
        <h3>Revenue Entries</h3>
        <p style={{ opacity: 0.7 }}>
          V1 view: raw rows. We can format columns once you confirm your revenue_entries schema fields.
        </p>

        <pre style={{ padding: 12, border: "1px solid #ccc", overflowX: "auto", fontSize: 12 }}>
          {JSON.stringify(rows, null, 2)}
        </pre>
      </div>
    </main>
  );
}
