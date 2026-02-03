"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };
type OpportunityLite = { id: string; name: string | null };

type ActivityRow = {
  activity_id: string;
  opportunity_id: string;
  activity_type: string | null;
  summary: string | null;
  details: string | null;
  occurred_at: string | null;
  created_by: string | null;
  created_at: string;
};

export default function ActivitiesPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opps, setOpps] = useState<OpportunityLite[]>([]);
  const [oppsError, setOppsError] = useState<string | null>(null);

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // Create form
  const [opportunityId, setOpportunityId] = useState("");
  const [activityType, setActivityType] = useState("CALL");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";

  const canCreate = useMemo(() => {
    // activities_insert_internal_by_opportunity_account allows STAFF/OPS/SALES/MARKETING
    return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(role);
  }, [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/activities");
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
      .from("activities")
      .select("activity_id, opportunity_id, activity_type, summary, details, occurred_at, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      return;
    }
    setRows((data ?? []) as ActivityRow[]);
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return setRowsError("You do not have permission to create activities.");
    if (!opportunityId) return setRowsError("Pick an opportunity.");

    setCreating(true);
    setRowsError(null);

    const { error } = await supabase.from("activities").insert({
      opportunity_id: opportunityId,
      activity_type: activityType as any,
      summary: summary || null,
      details: details || null,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      created_by: profile?.id ?? null,
    });

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setOpportunityId("");
    setActivityType("CALL");
    setSummary("");
    setDetails("");
    setOccurredAt("");
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

  if (loading) return <main style={{ padding: 24 }}>Loading activities…</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Activities Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Activities</h1>
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
          <h3 style={{ marginTop: 0 }}>Log Activity</h3>
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
              Activity type
              <select value={activityType} onChange={(e) => setActivityType(e.target.value)} style={{ width: "100%" }}>
                <option value="CALL">CALL</option>
                <option value="EMAIL">EMAIL</option>
                <option value="MEETING">MEETING</option>
                <option value="NOTE">NOTE</option>
              </select>
            </label>

            <label>
              Summary
              <input value={summary} onChange={(e) => setSummary(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Details
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Occurred at
              <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={{ width: "100%" }} />
            </label>

            <button disabled={creating} type="submit">
              {creating ? "Saving..." : "Save activity"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Activity Log</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Type</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Summary</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>When</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.activity_id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{a.activity_type ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{a.summary ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {a.occurred_at ? new Date(a.occurred_at).toLocaleString() : "(none)"}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{a.opportunity_id}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, opacity: 0.7 }}>
                  No activities yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
