"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

/* =========================
   TYPES
========================= */
type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
  created_at?: string;
};

/* =========================
   COMPONENT
========================= */
export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CEO panel state
  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  /* =========================
     LOAD MY PROFILE
  ========================= */
  async function loadMyProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/dashboard");
      return;
    }

    setEmail(user.email ?? null);

    const { data: myProfile, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, account_id, created_at")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setError(profErr.message);
      setLoading(false);
      return;
    }

    setProfile(myProfile);
    setLoading(false);
  }

  /* =========================
     LOAD USERS (CEO ONLY)
  ========================= */
  async function loadAllUsersIfCEO(currentProfile: Profile) {
    if (currentProfile.role !== "CEO") return;

    setUsersLoading(true);
    setUsersError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, account_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setUsersError(error.message);
      setUsersLoading(false);
      return;
    }

    setUsers(data ?? []);
    setUsersLoading(false);
  }

  /* =========================
     UPDATE USER ROLE (CEO)
  ========================= */
  async function updateUserRole(userId: string, newRole: string) {
    setUsersError(null);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      setUsersError(error.message);
      return;
    }

    if (profile) await loadAllUsersIfCEO(profile);
  }

  /* =========================
     LOGOUT
  ========================= */
  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  /* =========================
     EFFECTS
  ========================= */
  useEffect(() => {
    loadMyProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) loadAllUsersIfCEO(profile);
  }, [profile]);

  /* =========================
     RENDER STATES
  ========================= */
  if (loading) {
    return <main style={{ padding: 24 }}>Loading dashboard...</main>;
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Dashboard Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Dashboard</h2>
        <p>Profile not found.</p>
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  /* =========================
     ROLE FLAGS
  ========================= */
  const role = profile.role ?? "PENDING";
  const isPending = role === "PENDING";
  const isCEO = role === "CEO";

  /* =========================
     STEP 2: ROLE-BASED NAV
  ========================= */
  const navLinks: { href: string; label: string; roles: string[] }[] = [
    { href: "/sales", label: "Sales Pipeline", roles: ["CEO","ADMIN","SALES","OPS","MARKETING","STAFF"] },
    { href: "/contacts", label: "Contacts", roles: ["CEO","ADMIN","SALES","OPS","MARKETING","STAFF"] },
    { href: "/meetings", label: "Meetings", roles: ["CEO","ADMIN","SALES","OPS","MARKETING","STAFF"] },
    { href: "/discovery", label: "Discovery Sessions", roles: ["CEO","ADMIN","SALES","OPS","STAFF","MARKETING"] },
    { href: "/proposals", label: "Proposals", roles: ["CEO","ADMIN","SALES","OPS","STAFF","MARKETING"] },
    { href: "/projects", label: "Projects", roles: ["CEO","ADMIN","OPS","STAFF","SALES","MARKETING"] },
    { href: "/tasks", label: "Tasks", roles: ["CEO","ADMIN","SALES","OPS","STAFF","MARKETING"] },
    { href: "/activities", label: "Activities", roles: ["CEO","ADMIN","SALES","OPS","STAFF","MARKETING"] },
    { href: "/revenue", label: "Revenue (CEO/Admin)", roles: ["CEO","ADMIN"] },
  ];

  /* =========================
     RENDER
  ========================= */
  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1>Freshware Dashboard</h1>

      {/* USER INFO */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd" }}>
        <div><b>Logged in as:</b> {email}</div>
        <div><b>Name:</b> {profile.full_name ?? "(no name)"}</div>
        <div><b>Role:</b> {profile.role}</div>
        <div><b>Account:</b> {profile.account_id ?? "(none)"}</div>
      </div>

      {/* ACCESS STATUS */}
      {isPending ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>Pending Approval ⏳</h3>
          <p>Your account is created but needs CEO approval.</p>
        </div>
      ) : (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>Access Granted ✅</h3>
          <p>Select a tool below to start working.</p>
        </div>
      )}

      {/* STEP 2: TOOLS / NAV */}
      {!isPending && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>Tools</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {navLinks
              .filter((l) => l.roles.includes(role))
              .map((l) => (
                <button key={l.href} onClick={() => router.push(l.href)}>
                  {l.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* CEO ADMIN PANEL */}
      {isCEO && (
        <div style={{ marginTop: 24, padding: 16, border: "2px solid #111" }}>
          <h2>CEO Admin Panel</h2>
          <p>Approve users and assign roles.</p>

          {usersLoading && <p>Loading users...</p>}
          {usersError && <p style={{ color: "crimson" }}>{usersError}</p>}

          {!usersLoading && (
            <>
              <div style={{ marginBottom: 10 }}>
                <b>Total users:</b> {users.length}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Name</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Role</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                        {u.full_name ?? "(no name)"}
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{u.id}</div>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{u.role}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                        {["STAFF","SALES","OPS","MARKETING","ADMIN","CLIENT","PENDING"].map((r) => (
                          <button
                            key={r}
                            style={{ marginRight: 4 }}
                            onClick={() => updateUserRole(u.id, r)}
                          >
                            Set {r}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button onClick={logout}>Log out</button>
      </div>
    </main>
  );
}
