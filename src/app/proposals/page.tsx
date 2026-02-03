"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };
type OpportunityLite = { id: string; name: string | null };

type ProposalRow = {
  proposal_id: string;
  opportunity_id: string;
  proposal_version: number | null;
  total_project_cost: number | null;
  timeline_months: number | null;
  payment_structure: string | null;
  sent_date: string | null;
  signed_date: string | null;
  created_by: string | null;
  created_at: string;
};

export default function ProposalsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opps, setOpps] = useState<OpportunityLite[]>([]);
  const [oppsError, setOppsError] = useState<string | null>(null);

  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // create form
  const [opportunityId, setOpportunityId] = useState("");
  const [version, setVersion] = useState("1");
  const [totalCost, setTotalCost] = useState("15000");
  const [timelineMonths, setTimelineMonths] = useState("3");
  const [paymentStructure, setPaymentStructure] = useState("milestones");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";

  const canCreate = useMemo(() => {
    // proposals_insert_sales_ops_by_opportunity_account
    return ["CEO", "ADMIN", "SALES", "OPS"].includes(role);
  }, [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/proposals");
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
      .from("proposals")
      .select("proposal_id, opportunity_id, proposal_version, total_project_cost, timeline_months, payment_structure, sent_date, signed_date, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      return;
    }
    setRows((data ?? []) as ProposalRow[]);
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return setRowsError("You do not have permission to create proposals.");
    if (!opportunityId) return setRowsError("Pick an opportunity.");

    setCreating(true);
    setRowsError(null);

    const { error } = await supabase.from("proposals").insert({
      opportunity_id: opportunityId,
      proposal_version: Number(version) || 1,
      total_project_cost: Number(totalCost) || null,
      timeline_months: Number(timelineMonths) || null,
      payment_structure: paymentStructure as any,
      created_by: profile?.id ?? null,
    });

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setOpportunityId("");
    setVersion("1");
    setTotalCost("15000");
    setTimelineMonths("3");
    setPaymentStructure("milestones");
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

  if (loading) return <main style={{ padding: 24 }}>Loading proposals…</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Proposals Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Proposals</h1>

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
          <h3 style={{ marginTop: 0 }}>Create Proposal</h3>
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
              Version
              <input value={version} onChange={(e) => setVersion(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Total project cost
              <input value={totalCost} onChange={(e) => setTotalCost(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Timeline (months)
              <input value={timelineMonths} onChange={(e) => setTimelineMonths(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Payment structure
              <select value={paymentStructure} onChange={(e) => setPaymentStructure(e.target.value)} style={{ width: "100%" }}>
                <option value="milestones">milestones</option>
                <option value="monthly">monthly</option>
                <option value="upfront">upfront</option>
              </select>
            </label>

            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create proposal"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Proposals</h3>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Version</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Total</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Timeline</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Payment</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.proposal_id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.proposal_version ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.total_project_cost ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.timeline_months ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.payment_structure ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.opportunity_id}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 8, opacity: 0.7 }}>
                  No proposals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
