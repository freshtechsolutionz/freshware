"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };
type OpportunityLite = { id: string; name: string | null };

type DiscoveryRow = {
  discovery_id: string;
  opportunity_id: string;
  current_systems: string | null;
  pain_points: string | null;
  success_metrics: string | null;
  recommended_phases: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export default function DiscoveryPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opps, setOpps] = useState<OpportunityLite[]>([]);
  const [oppsError, setOppsError] = useState<string | null>(null);

  const [rows, setRows] = useState<DiscoveryRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [opportunityId, setOpportunityId] = useState("");
  const [currentSystems, setCurrentSystems] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [successMetrics, setSuccessMetrics] = useState("");
  const [recommendedPhases, setRecommendedPhases] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";
  const canCreate = useMemo(() => ["CEO", "ADMIN", "SALES", "OPS"].includes(role), [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/discovery");
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
      .from("discovery_sessions")
      .select("discovery_id, opportunity_id, current_systems, pain_points, success_metrics, recommended_phases, notes, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      return;
    }
    setRows((data ?? []) as DiscoveryRow[]);
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return setRowsError("You do not have permission to create discovery sessions.");
    if (!opportunityId) return setRowsError("Pick an opportunity.");

    setCreating(true);
    setRowsError(null);

    const { error } = await supabase.from("discovery_sessions").insert({
      opportunity_id: opportunityId,
      current_systems: currentSystems || null,
      pain_points: painPoints || null,
      success_metrics: successMetrics || null,
      recommended_phases: recommendedPhases || null,
      notes: notes || null,
      created_by: profile?.id ?? null,
    });

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setOpportunityId("");
    setCurrentSystems("");
    setPainPoints("");
    setSuccessMetrics("");
    setRecommendedPhases("");
    setNotes("");
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

  if (loading) return <main style={{ padding: 24 }}>Loading discovery…</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Discovery Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Discovery Sessions</h1>

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
          <h3 style={{ marginTop: 0 }}>Create Discovery Session</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 700 }}>
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
              Current systems
              <textarea value={currentSystems} onChange={(e) => setCurrentSystems(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Pain points
              <textarea value={painPoints} onChange={(e) => setPainPoints(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Success metrics
              <textarea value={successMetrics} onChange={(e) => setSuccessMetrics(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Recommended phases
              <textarea value={recommendedPhases} onChange={(e) => setRecommendedPhases(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%" }} />
            </label>

            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create discovery"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Discovery Sessions</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Opportunity</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Pain Points</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.discovery_id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{d.opportunity_id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{d.pain_points ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {d.created_at ? new Date(d.created_at).toLocaleString() : "(none)"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 8, opacity: 0.7 }}>
                  No discovery sessions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
