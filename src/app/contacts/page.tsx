"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };

type Contact = {
  id: string;
  account_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: string | null;
  created_at: string;
};

export default function ContactsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Contact[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("manual");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";

  const canCreate = useMemo(() => {
    // contacts_insert_sales_ops_same_account (we allow SALES/OPS; CEO/ADMIN ok too)
    return ["CEO", "ADMIN", "SALES", "OPS"].includes(role);
  }, [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/contacts");
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
    setRowsLoading(true);
    setRowsError(null);

    const { data, error } = await supabase
      .from("contacts")
      .select("id, account_id, name, email, phone, title, source, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      setRowsLoading(false);
      return;
    }

    setRows((data ?? []) as Contact[]);
    setRowsLoading(false);
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.account_id) {
      setRowsError("Missing account_id on your profile. CEO must assign your account_id.");
      return;
    }
    if (!canCreate) {
      setRowsError("You do not have permission to create contacts.");
      return;
    }

    setCreating(true);
    setRowsError(null);

    const payload = {
      account_id: profile.account_id, // REQUIRED for your RLS policies
      name: name || null,
      email: email || null,
      phone: phone || null,
      title: title || null,
      source: source || null,
    };

    const { error } = await supabase.from("contacts").insert(payload);

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setSource("manual");
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

  if (loading) return <main style={{ padding: 24 }}>Loading contacts...</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Contacts Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Contacts</h1>

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
          <h3 style={{ marginTop: 0 }}>Create Contact</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Source
              <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: "100%" }}>
                <option value="manual">manual</option>
                <option value="referral">referral</option>
                <option value="event">event</option>
                <option value="cold_outreach">cold_outreach</option>
              </select>
            </label>
            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create contact"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Contacts</h3>
        {rowsLoading ? (
          <p>Loading…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Phone</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Source</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{c.name ?? "(no name)"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{c.email ?? "(none)"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{c.phone ?? "(none)"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{c.source ?? "(none)"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : "(none)"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 8, opacity: 0.7 }}>
                    No contacts yet.
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
