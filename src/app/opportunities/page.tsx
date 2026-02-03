"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type AccountLite = {
  id: string;
  name: string | null;
  industry: string | null;
};

type ContactLite = {
  id: string;
  name: string | null;
  email: string | null;
  account_id: string;
};

type Opportunity = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  name: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  last_activity_at: string | null;
  created_at: string;
};

const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

export default function OpportunitiesPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [rows, setRows] = useState<Opportunity[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);

  // create form
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [oppName, setOppName] = useState("");
  const [serviceLine, setServiceLine] = useState("Mobile App Development");
  const [stage, setStage] = useState("new");
  const [amount, setAmount] = useState("10000");
  const [probability, setProbability] = useState("20");
  const [closeDate, setCloseDate] = useState("");

  // inline update
  const [savingId, setSavingId] = useState<string | null>(null);

  const role = profile?.role ?? "PENDING";

  const canCreate = useMemo(() => {
    return ["CEO", "ADMIN", "SALES", "OPS"].includes(role);
  }, [role]);

  const canUpdate = useMemo(() => {
    return ["CEO", "ADMIN", "SALES", "OPS"].includes(role);
  }, [role]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  async function loadProfile() {
    setLoading(true);
    setPageError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/opportunities");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, account_id")
      .eq("id", user.id)
      .single();

    if (error) {
      setPageError(error.message);
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);
  }

  async function loadLookups() {
    setLookupError(null);

    const aRes = await supabase
      .from("accounts")
      .select("id, name, industry")
      .order("created_at", { ascending: false });

    if (aRes.error) {
      setLookupError(aRes.error.message);
      return;
    }
    setAccounts((aRes.data ?? []) as AccountLite[]);

    const cRes = await supabase
      .from("contacts")
      .select("id, name, email, account_id")
      .order("created_at", { ascending: false });

    if (cRes.error) {
      setLookupError(cRes.error.message);
      return;
    }
    setContacts((cRes.data ?? []) as ContactLite[]);
  }

  async function loadOpportunities() {
    setRowsLoading(true);
    setRowsError(null);

    const { data, error } = await supabase
      .from("opportunities")
      .select(
        "id, account_id, contact_id, owner_user_id, name, service_line, stage, amount, probability, close_date, last_activity_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setRowsError(error.message);
      setRowsLoading(false);
      return;
    }

    setRows((data ?? []) as Opportunity[]);
    setRowsLoading(false);
  }

  function filteredContacts() {
    if (!accountId) return contacts;
    return contacts.filter((c) => c.account_id === accountId);
  }

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setRowsError(null);

    if (!canCreate) {
      setRowsError("You do not have permission to create opportunities.");
      return;
    }

    if (!profile?.account_id) {
      setRowsError(
        "Your profile is missing account_id. Assign your account_id (CEO) before creating opportunities."
      );
      return;
    }

    if (!accountId) {
      setRowsError("Select an account.");
      return;
    }

    if (!oppName.trim()) {
      setRowsError("Opportunity name is required.");
      return;
    }

    setCreating(true);

    const payload = {
      account_id: accountId,
      contact_id: contactId || null,
      owner_user_id: profile.id,
      name: oppName.trim(),
      service_line: serviceLine || null,
      stage,
      amount: Number(amount) || 0,
      probability: Number(probability) || 0,
      close_date: closeDate || null,
      last_activity_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("opportunities").insert(payload);

    if (error) {
      setRowsError(error.message);
      setCreating(false);
      return;
    }

    setOppName("");
    setServiceLine("Mobile App Development");
    setStage("new");
    setAmount("10000");
    setProbability("20");
    setCloseDate("");
    setContactId("");

    setCreating(false);
    await loadOpportunities();
  }

  async function updateOpportunity(
    id: string,
    patch: Partial<
      Pick<
        Opportunity,
        "name" | "service_line" | "stage" | "amount" | "probability" | "close_date"
      >
    >
  ) {
    if (!canUpdate) {
      setRowsError("You do not have permission to update opportunities.");
      return;
    }

    setSavingId(id);
    setRowsError(null);

    const { error } = await supabase.from("opportunities").update(patch).eq("id", id);

    if (error) {
      setRowsError(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadOpportunities();
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadLookups();
    loadOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <main style={{ padding: 24 }}>Loading opportunities…</main>;

  if (pageError) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Opportunities Error</h2>
        <p style={{ color: "crimson" }}>{pageError}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1>Opportunities</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/dashboard")}>← Dashboard</button>{" "}
        <button onClick={() => router.push("/sales")}>Sales Pipeline</button>{" "}
        <button onClick={logout}>Log out</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd" }}>
        <div>
          <b>User:</b> {profile?.full_name ?? "(no name)"}
        </div>
        <div>
          <b>Role:</b> {role}
        </div>
        <div>
          <b>Account:</b> {profile?.account_id ?? "(none)"}
        </div>
      </div>

      {lookupError && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ccc" }}>
          <b style={{ color: "crimson" }}>Lookup Error:</b> {lookupError}
        </div>
      )}

      {rowsError && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ccc" }}>
          <b style={{ color: "crimson" }}>Error:</b> {rowsError}
        </div>
      )}

      {/* CREATE */}
      {canCreate ? (
        <form
          onSubmit={createOpportunity}
          style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}
        >
          <h3 style={{ marginTop: 0 }}>Create Opportunity</h3>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Account *
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setContactId("");
                }}
                style={{ width: "100%" }}
              >
                <option value="">-- select account --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Contact (optional)
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">-- select contact --</option>
                {filteredContacts().map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.email ?? c.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Opportunity name *
              <input
                value={oppName}
                onChange={(e) => setOppName(e.target.value)}
                placeholder="e.g. Mobile App for ABC Dental"
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Service line
              <input
                value={serviceLine}
                onChange={(e) => setServiceLine(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Stage
              <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ width: "100%" }}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Amount ($)
              <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Probability (%)
              <input
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Close date
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create opportunity"}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", opacity: 0.8 }}>
          <b>Create disabled:</b> Only CEO/ADMIN/SALES/OPS can create opportunities.
        </div>
      )}

      {/* LIST */}
      <div style={{ marginTop: 22 }}>
        <h3>Opportunities</h3>

        {rowsLoading ? (
          <p>Loading…</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Name</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Stage</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Amount</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Prob%</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Close</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    <div style={{ fontWeight: 600 }}>{o.name ?? "(no name)"}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{o.id}</div>
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {canUpdate ? (
                      <select
                        value={o.stage ?? "new"}
                        onChange={(e) => updateOpportunity(o.id, { stage: e.target.value })}
                        disabled={savingId === o.id}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      o.stage ?? "(none)"
                    )}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {canUpdate ? (
                      <input
                        defaultValue={String(o.amount ?? 0)}
                        onBlur={(e) => updateOpportunity(o.id, { amount: Number(e.target.value) || 0 })}
                        disabled={savingId === o.id}
                        style={{ width: 110 }}
                      />
                    ) : (
                      o.amount ?? 0
                    )}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {canUpdate ? (
                      <input
                        defaultValue={String(o.probability ?? 0)}
                        onBlur={(e) => updateOpportunity(o.id, { probability: Number(e.target.value) || 0 })}
                        disabled={savingId === o.id}
                        style={{ width: 70 }}
                      />
                    ) : (
                      o.probability ?? 0
                    )}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {canUpdate ? (
                      <input
                        type="date"
                        defaultValue={o.close_date ?? ""}
                        onBlur={(e) => updateOpportunity(o.id, { close_date: e.target.value || null })}
                        disabled={savingId === o.id}
                      />
                    ) : (
                      o.close_date ?? "(none)"
                    )}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {savingId === o.id ? "Saving…" : "—"}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 8, opacity: 0.7 }}>
                    No opportunities yet.
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
