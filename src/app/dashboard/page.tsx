"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at?: string;
};

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

  async function loadMyProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      setLoading(false);
      // send them to login; full reload keeps middleware happy
      window.location.assign("/login?next=/dashboard");
      return;
    }

    setEmail(user.email ?? null);

    const { data: myProfile, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
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

  async function loadAllUsersIfCEO(currentProfile: Profile) {
    if (currentProfile.role !== "CEO") return;

    setUsersLoading(true);
    setUsersError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setUsersError(error.message);
      setUsersLoading(false);
      return;
    }

    setUsers(data ?? []);
    setUsersLoading(false);
  }

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

  async function logout() {
    await supabase.auth.signOut();
    // full reload so cookies/middleware are definitely in sync
    window.location.assign("/login");
  }

  useEffect(() => {
    loadMyProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) loadAllUsersIfCEO(profile);
  }, [profile]);

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

  const isPending = profile.role === "PENDING";
  const isCEO = profile.role === "CEO";

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Freshware Dashboard</h1>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd" }}>
        <div>
          <b>Logged in as:</b> {email}
        </div>
        <div>
          <b>Name:</b> {profile.full_name ?? "(no name)"}
        </div>
        <div>
          <b>Role:</b> {profile.role ?? "(none)"}
        </div>
      </div>

      {isPending ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>Pending Approval ⏳</h3>
          <p>Your account is created, but still needs approval from the CEO.</p>
        </div>
      ) : (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3>Access Granted ✅</h3>
          <p>Welcome! Next step: show your KPIs and tools based on your role.</p>
        </div>
      )}

      {isCEO && (
        <div style={{ marginTop: 24, padding: 16, border: "2px solid #111" }}>
          <h2>CEO Admin Panel</h2>
          <p style={{ marginTop: 6 }}>
            Approve users and assign roles. (Only visible to CEO.)
          </p>

          {usersLoading && <p>Loading users...</p>}
          {usersError && <p style={{ color: "crimson" }}>{usersError}</p>}

          {!usersLoading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 10 }}>
                <b>Total users:</b> {users.length}
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                      Name
                    </th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                      Role
                    </th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                        {u.full_name ?? "(no name)"}
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{u.id}</div>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                        {u.role ?? "(none)"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                        {u.role === "PENDING" ? (
  <>
    <button onClick={() => updateUserRole(u.id, "STAFF")}>
      Approve as STAFF
    </button>{" "}
    <button onClick={() => updateUserRole(u.id, "ADMIN")}>
      Approve as ADMIN
    </button>{" "}
    <button onClick={() => updateUserRole(u.id, "CLIENT")}>
      Approve as CLIENT
    </button>
  </>
) : (
  <>
    <button onClick={() => updateUserRole(u.id, "STAFF")}>Set STAFF</button>{" "}
    <button onClick={() => updateUserRole(u.id, "ADMIN")}>Set ADMIN</button>{" "}
    <button onClick={() => updateUserRole(u.id, "CLIENT")}>Set CLIENT</button>{" "}
    <button onClick={() => updateUserRole(u.id, "PENDING")}>Set PENDING</button>
  </>
)}

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button onClick={logout}>Log out</button>
      </div>
    </main>
  );
}
