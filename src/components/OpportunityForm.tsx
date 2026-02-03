"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { SALES_STAGES, SERVICE_LINES, formatServiceLine } from "@/lib/salesConfig";

const supabase = supabaseBrowser();

type Account = { id: string; name: string | null };
type Contact = { id: string; name: string | null; email: string | null; account_id?: string | null };

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
};

export default function OpportunityForm({
  mode,
  initial,
  accounts,
  contacts,
  afterSaveHref,
}: {
  mode: "create" | "edit";
  initial: Opportunity | null;
  accounts: Account[];
  contacts: Contact[];
  afterSaveHref: string;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? "");
  const [stage, setStage] = useState(initial?.stage ?? "new");
  const [serviceLine, setServiceLine] = useState(initial?.service_line ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? 0));
  const [probability, setProbability] = useState(String(initial?.probability ?? 0));
  const [closeDate, setCloseDate] = useState(initial?.close_date ?? "");
  const [accountId, setAccountId] = useState(initial?.account_id ?? "");
  const [contactId, setContactId] = useState(initial?.contact_id ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    if (!accountId) return contacts || [];
    return (contacts || []).filter((c) => (c.account_id || "") === accountId);
  }, [contacts, accountId]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: any = {
      name: name.trim().length ? name.trim() : null,
      stage: stage || "new",
      service_line: serviceLine || null,
      amount: Number(amount || 0),
      probability: Number(probability || 0),
      close_date: closeDate || null,
      account_id: accountId || null,
      contact_id: contactId || null,
    };

    // On create, set owner_user_id to current user
    if (mode === "create") {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (uid) payload.owner_user_id = uid;
    }

    try {
      if (mode === "create") {
        const { error: insErr } = await supabase.from("opportunities").insert(payload);
        if (insErr) throw new Error(insErr.message);

        setSuccess("Opportunity created ✅");
        router.push(afterSaveHref);
        router.refresh();
        return;
      }

      // edit
      if (!initial?.id) throw new Error("Missing opportunity id");
      const { error: updErr } = await supabase
        .from("opportunities")
        .update(payload)
        .eq("id", initial.id);

      if (updErr) throw new Error(updErr.message);

      setSuccess("Opportunity updated ✅");
      router.push(afterSaveHref);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOpportunity() {
    if (!initial?.id) return;
    const ok = window.confirm("Delete this opportunity? This cannot be undone.");
    if (!ok) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: delErr } = await supabase
      .from("opportunities")
      .delete()
      .eq("id", initial.id);

    if (delErr) {
      setError(delErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(afterSaveHref);
    router.refresh();
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <Field label="Opportunity name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., GHBC App Platform"
            style={inputStyle}
          />
        </Field>

        <Field label="Stage">
          <select value={stage} onChange={(e) => setStage(e.target.value)} style={inputStyle}>
            {SALES_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Service line">
          <select
            value={serviceLine}
            onChange={(e) => setServiceLine(e.target.value)}
            style={inputStyle}
          >
            <option value="">—</option>
            {SERVICE_LINES.map((s) => (
              <option key={s} value={s}>
                {formatServiceLine(s)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Amount">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            style={inputStyle}
          />
        </Field>

        <Field label="Probability (%)">
          <input
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            inputMode="numeric"
            style={inputStyle}
          />
        </Field>

        <Field label="Close date">
          <input
            type="date"
            value={closeDate || ""}
            onChange={(e) => setCloseDate(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Account">
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              // reset contact if account changes
              setContactId("");
            }}
            style={inputStyle}
          >
            <option value="">—</option>
            {(accounts || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.id}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Contact (filtered by account when set)">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.name || "Unnamed") + (c.email ? ` (${c.email})` : "")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "crimson" }}>
          <b>Error:</b> {error}
        </div>
      )}

      {success && (
        <div style={{ marginTop: 12, color: "green" }}>
          <b>{success}</b>
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : mode === "create" ? "Create Opportunity" : "Save Changes"}
        </button>

        <button
          onClick={() => {
            router.push(afterSaveHref);
            router.refresh();
          }}
          disabled={saving}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>

        {mode === "edit" && (
          <button
            onClick={deleteOpportunity}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ef4444",
              background: "#fff",
              color: "#ef4444",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Delete
          </button>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
        Tip: For v1, keep “create” tight (CEO/ADMIN/SALES). Everyone else can view/edit if RLS allows.
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
};
