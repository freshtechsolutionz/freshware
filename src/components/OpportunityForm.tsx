"use client";

import { useEffect, useMemo, useState } from "react";
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

  // Auto-assign account on create if blank (from current user's profile)
  useEffect(() => {
    if (mode !== "create") return;
    if (accountId) return;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) return;

      const { data: prof } = await supabase.from("profiles").select("account_id").eq("id", uid).maybeSingle();
      const acct = (prof as any)?.account_id ?? null;

      if (acct) setAccountId(acct);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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

    try {
      if (mode === "create") {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (uid) payload.owner_user_id = uid;

        // Require account_id for create (keeps data clean)
        if (!payload.account_id) {
          throw new Error("Account is required. Assign an account to your profile or select one.");
        }

        const { error: insErr } = await supabase.from("opportunities").insert(payload);
        if (insErr) throw new Error(insErr.message);

        setSuccess("Opportunity created");
        router.push(afterSaveHref);
        router.refresh();
        return;
      }

      if (!initial?.id) throw new Error("Missing opportunity id");

      const res = await fetch(`/api/opportunities/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Save failed");

      setSuccess("Opportunity updated");
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

    const ok = window.confirm("Delete this opportunity? This will archive it.");
    if (!ok) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/opportunities/${initial.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete failed");

      router.push(afterSaveHref);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Delete failed");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Opportunity name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., GHBC App Platform"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Stage">
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
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
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="">(none)</option>
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
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Probability (%)">
          <input
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Close date">
          <input
            type="date"
            value={closeDate || ""}
            onChange={(e) => setCloseDate(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Account">
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setContactId("");
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="">(none)</option>
            {(accounts || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.id}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Contact (filtered by account when set)">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            <option value="">(none)</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.name || "Unnamed") + (c.email ? ` (${c.email})` : "")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border bg-background p-3 text-sm">
          <b className="text-red-600">Error:</b> {error}
        </div>
      )}

      {success && (
        <div className="mt-3 rounded-xl border bg-background p-3 text-sm">
          <b className="text-green-700">{success}</b>
        </div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <button
          onClick={save}
          disabled={saving}
          className="w-full sm:w-auto rounded-xl border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Opportunity" : "Save Changes"}
        </button>

        <button
          onClick={() => {
            router.push(afterSaveHref);
            router.refresh();
          }}
          disabled={saving}
          className="w-full sm:w-auto rounded-xl border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted/30 transition"
        >
          Cancel
        </button>

        {mode === "edit" && (
          <button
            onClick={deleteOpportunity}
            disabled={saving}
            className="w-full sm:w-auto sm:ml-auto rounded-xl border border-red-200 bg-background px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
