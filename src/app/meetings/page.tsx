"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type Meeting = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  scheduled_at: string | null;
  status: string | null;
  source: string | null;
  created_at: string;
  account_id: string;
};

export default function MeetingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Meeting[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // Create form
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";

  const canCreate = useMemo(() => {
    // meetings_insert_sales_ops_same_account (plus CEO/ADMIN already allowed by ceo/admin policies)
    return ["CEO", "ADMIN", "SALES", "OPS"].includes(role);
  }, [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/meetings");
      return;
    }

    const { data: p, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, account_id")
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
    setRowsLoading(true);
    setRowsError(null);

    const { data, error } = await supabase
      .from("meetings")
      .select("id, contact_name, contact_email, scheduled_at, status, source, created_at, account_id")
      .order("scheduled_at", { ascending: true });

    if (error) {
      setRowsError(error.message);
      setRowsLoading(false);
      return;
    }

    setRows((data ?? []) as Meeting[]);
    setRowsLoading(false);
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.account_id) {
      setRowsError("Missing account_id on your profile. CEO must assign your account_id.");
      return;
    }
    if (!canCreate) {
      setRowsError("You do not have permission to create meetings.");
      return;
    }

    setCreating(true);
    setRowsError(null);

    const payload = {
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status,
      source: "manual",
      account_id: profile.account_id, // send even though DB default exists
    };

    const { error } = await supabase.from("meetings").insert(payload);

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setContactName("");
    setContactEmail("");
    setScheduledAt("");
    setStatus("scheduled");
    setCreating(false);

    await loadRows();
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
    if (profile) loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <main style={{ padding: 24 }}>Loading meetings...</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Meetings Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Meetings</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/dashboard")}>← Dashboard</button>{" "}
        <button onClick={logout}>Log out</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd" }}>
        <b>Role:</b> {role} <br />
        <b>Account:</b> {profile?.account_id ?? "(none)"}
      </div>

      {rowsError && <p style={{ color: "crimson" }}>{rowsError}</p>}

      {canCreate && (
        <form onSubmit={createRow} style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3 style={{ marginTop: 0 }}>Create Meeting</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label>
              Contact name
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Contact email
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Scheduled at
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
                <option value="scheduled">scheduled</option>
                <option value="completed">completed</option>
                <option value="canceled">canceled</option>
              </select>
            </label>
            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create meeting"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Meetings</h3>
        {rowsLoading ? (
          <p>Loading…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>When</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Contact</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "(none)"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{m.contact_name ?? "(none)"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{m.contact_email ?? "(none)"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{m.status ?? "(none)"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 8, opacity: 0.7 }}>
                    No meetings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
