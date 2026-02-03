"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };
type OpportunityLite = { id: string; name: string | null };

type TaskRow = {
  task_id: string;
  opportunity_id: string;
  title: string | null;
  description: string | null;
  due_at: string | null;
  status: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export default function TasksPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opps, setOpps] = useState<OpportunityLite[]>([]);
  const [oppsError, setOppsError] = useState<string | null>(null);

  const [rows, setRows] = useState<TaskRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // Create form
  const [opportunityId, setOpportunityId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [status, setStatus] = useState("open");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";

  const canCreate = useMemo(() => {
    // tasks_insert_sales_ops_by_opportunity_account
    return ["CEO", "ADMIN", "SALES", "OPS"].includes(role);
  }, [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/tasks");
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

  async function loadOpps() {
    setOppsError(null);
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) {
      setOppsError(error.message);
      return;
    }
    setOpps((data ?? []) as OpportunityLite[]);
  }

  async function loadRows() {
    setRowsError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("task_id, opportunity_id, title, description, due_at, status, assigned_to, created_by, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      return;
    }
    setRows((data ?? []) as TaskRow[]);
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return setRowsError("You do not have permission to create tasks.");
    if (!opportunityId) return setRowsError("Pick an opportunity.");

    setCreating(true);
    setRowsError(null);

    const { error } = await supabase.from("tasks").insert({
      opportunity_id: opportunityId,
      title: title || null,
      description: desc || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      status: status as any,
      assigned_to: null,
      created_by: profile?.id ?? null,
    });

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setOpportunityId("");
    setTitle("");
    setDesc("");
    setDueAt("");
    setStatus("open");
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
    if (!profile) return;
    loadOpps();
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <main style={{ padding: 24 }}>Loading tasks…</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Tasks Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Tasks</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/dashboard")}>← Dashboard</button>{" "}
        <button onClick={logout}>Log out</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd" }}>
        <b>Role:</b> {role} <br />
        <b>Account:</b> {profile?.account_id ?? "(none)"}
      </div>

      {oppsError && <p style={{ color: "crimson" }}>{oppsError}</p>}
      {rowsError && <p style={{ color: "crimson" }}>{rowsError}</p>}

      {canCreate && (
        <form onSubmit={createRow} style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3 style={{ marginTop: 0 }}>Create Task</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label>
              Opportunity
              <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- select --</option>
                {opps.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name ?? o.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Description
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Due at
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
                <option value="open">open</option>
                <option value="in_progress">in_progress</option>
                <option value="done">done</option>
              </select>
            </label>
            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create task"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Tasks</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Title</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Due</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.task_id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{t.title ?? "(no title)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{t.status ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{t.due_at ? new Date(t.due_at).toLocaleString() : "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{t.opportunity_id}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, opacity: 0.7 }}>
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
