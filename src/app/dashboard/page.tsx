"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }

      const user = authData.user;
      if (!user) {
        // Not logged in — send to login
        window.location.href = "/login";
        return;
      }

      setEmail(user.email ?? null);

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profErr) setError(profErr.message);
      else setProfile(prof);

      setLoading(false);
    }

    load();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) return <main style={{ padding: 24 }}>Loading dashboard...</main>;

  if (error)
    return (
      <main style={{ padding: 24 }}>
        <h2>Dashboard Error</h2>
        <p>{error}</p>
        <button onClick={logout} style={{ marginTop: 12 }}>
          Log out
        </button>
      </main>
    );

  const role = profile?.role ?? "PENDING";

  return (
    <main style={{ padding: 24, fontFamily: "Arial", maxWidth: 700 }}>
      <h1>Freshware Dashboard</h1>
      <p><b>Logged in as:</b> {email}</p>
      <p><b>Name:</b> {profile?.full_name ?? "—"}</p>
      <p><b>Role:</b> {role}</p>

      {role === "PENDING" ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>Pending Approval</h3>
          <p>
            Your account is created, but still needs approval from the CEO.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>Access Granted ✅</h3>
          <p>Welcome! Next step: show your KPIs and tools based on your role.</p>
        </div>
      )}

      <button onClick={logout} style={{ marginTop: 20 }}>
        Log out
      </button>
    </main>
  );
}
