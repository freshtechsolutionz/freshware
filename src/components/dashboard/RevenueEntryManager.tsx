"use client";

import { useMemo, useState } from "react";

type Option = {
  id: string;
  label: string;
};

type RevenueRow = {
  id: string;
  title: string | null;
  amount: number | null;
  recognized_on: string | null;
  entry_date: string | null;
  revenue_type: string | null;
  type: string | null;
  status: string | null;
  paid: boolean | null;
  category: string | null;
  company_id: string | null;
  project_id: string | null;
  opportunity_id: string | null;
  frequency: string | null;
  source: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
  payment_method?: string | null;
  invoice_number?: string | null;
  external_ref?: string | null;
};

type Props = {
  initialRevenue: RevenueRow[];
  companies: Option[];
  projects: Option[];
  opportunities: Option[];
};

type FormState = {
  title: string;
  amount: string;
  revenue_type: string;
  type: string;
  category: string;
  status: string;
  paid: boolean;
  recognized_on: string;
  entry_date: string;
  frequency: string;
  source: string;
  start_date: string;
  end_date: string;
  company_id: string;
  project_id: string;
  opportunity_id: string;
  description: string;
  payment_method: string;
  invoice_number: string;
  external_ref: string;
};

function money(n: number | null | undefined) {
  const v = Number(n || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function dateInputValue(v: string | null | undefined) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function emptyForm(): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    amount: "",
    revenue_type: "manual",
    type: "",
    category: "",
    status: "pending",
    paid: false,
    recognized_on: today,
    entry_date: today,
    frequency: "one_time",
    source: "manual",
    start_date: "",
    end_date: "",
    company_id: "",
    project_id: "",
    opportunity_id: "",
    description: "",
    payment_method: "",
    invoice_number: "",
    external_ref: "",
  };
}

export default function RevenueEntryManager(props: Props) {
  const [rows, setRows] = useState<RevenueRow[]>(props.initialRevenue || []);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) =>
      String(b.recognized_on || b.entry_date || "").localeCompare(String(a.recognized_on || a.entry_date || ""))
    );
  }, [rows]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(row: RevenueRow) {
    setErr(null);
    setMsg(null);
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      amount: String(row.amount ?? ""),
      revenue_type: row.revenue_type || "manual",
      type: row.type || "",
      category: row.category || "",
      status: row.status || "pending",
      paid: Boolean(row.paid),
      recognized_on: dateInputValue(row.recognized_on),
      entry_date: dateInputValue(row.entry_date),
      frequency: row.frequency || "one_time",
      source: row.source || "manual",
      start_date: dateInputValue(row.start_date),
      end_date: dateInputValue(row.end_date),
      company_id: row.company_id || "",
      project_id: row.project_id || "",
      opportunity_id: row.opportunity_id || "",
      description: row.description || "",
      payment_method: row.payment_method || "",
      invoice_number: row.invoice_number || "",
      external_ref: row.external_ref || "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!form.title.trim()) {
      setErr("Title is required.");
      return;
    }

    if (!form.amount.trim() || Number(form.amount) <= 0) {
      setErr("Amount must be greater than 0.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        revenue_type: form.revenue_type || "manual",
        type: form.type || null,
        category: form.category || null,
        status: form.status || "pending",
        paid: form.paid,
        recognized_on: form.recognized_on || null,
        entry_date: form.entry_date || null,
        frequency: form.frequency || "one_time",
        source: form.source || "manual",
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        company_id: form.company_id || null,
        project_id: form.project_id || null,
        opportunity_id: form.opportunity_id || null,
        description: form.description || null,
        payment_method: form.payment_method || null,
        invoice_number: form.invoice_number || null,
        external_ref: form.external_ref || null,
      };

      const url = editingId ? `/api/revenue/${editingId}` : `/api/revenue`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save revenue entry.");

      const updated = json?.revenue;
      if (updated) {
        if (editingId) {
          setRows((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
          setMsg("Revenue entry updated.");
        } else {
          setRows((prev) => [updated, ...prev]);
          setMsg("Revenue entry created.");
        }
      }

      resetForm();
    } catch (e: any) {
      setErr(e?.message || "Failed to save revenue entry.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    const confirmed = window.confirm("Delete this revenue entry?");
    if (!confirmed) return;

    setErr(null);
    setMsg(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/revenue/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete revenue entry.");

      setRows((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
      setMsg("Revenue entry deleted.");
    } catch (e: any) {
      setErr(e?.message || "Failed to delete revenue entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-gray-900">
          {editingId ? "Edit Revenue Entry" : "Create Revenue Entry"}
        </div>
        <div className="mt-1 text-sm text-gray-600">
          Add manual revenue or adjust existing entries.
        </div>

        {err ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {msg}
          </div>
        ) : null}

        <form onSubmit={submitForm} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Amount</label>
              <input
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Select label="Revenue Type" value={form.revenue_type} onChange={(v) => setField("revenue_type", v)} options={["manual", "project", "support", "other"]} />
            <Input label="Type" value={form.type} onChange={(v) => setField("type", v)} />
            <Input label="Category" value={form.category} onChange={(v) => setField("category", v)} />
            <Select label="Status" value={form.status} onChange={(v) => setField("status", v)} options={["pending", "received", "recognized", "active", "canceled"]} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <DateInput label="Recognized On" value={form.recognized_on} onChange={(v) => setField("recognized_on", v)} />
            <DateInput label="Entry Date" value={form.entry_date} onChange={(v) => setField("entry_date", v)} />
            <Select label="Frequency" value={form.frequency} onChange={(v) => setField("frequency", v)} options={["one_time", "monthly", "annual"]} />
            <Select label="Source" value={form.source} onChange={(v) => setField("source", v)} options={["manual", "opportunity", "project_support", "other"]} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <DateInput label="Start Date" value={form.start_date} onChange={(v) => setField("start_date", v)} />
            <DateInput label="End Date" value={form.end_date} onChange={(v) => setField("end_date", v)} />

            <div>
              <label className="mb-1 block text-sm font-medium">Company</label>
              <select
                value={form.company_id}
                onChange={(e) => setField("company_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {props.companies.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Project</label>
              <select
                value={form.project_id}
                onChange={(e) => setField("project_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {props.projects.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Opportunity</label>
              <select
                value={form.opportunity_id}
                onChange={(e) => setField("opportunity_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {props.opportunities.map((x) => (
                  <option key={x.id} value={x.id}>{x.label}</option>
                ))}
              </select>
            </div>

            <Input label="Payment Method" value={form.payment_method} onChange={(v) => setField("payment_method", v)} />
            <Input label="Invoice Number" value={form.invoice_number} onChange={(v) => setField("invoice_number", v)} />
            <Input label="External Ref" value={form.external_ref} onChange={(v) => setField("external_ref", v)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="min-h-[110px] w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => setField("paid", e.target.checked)}
            />
            Paid
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving..." : editingId ? "Update Revenue" : "Create Revenue"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              {editingId ? "Cancel Edit" : "Reset"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-gray-900">Manage Revenue Entries</div>
        <div className="mt-1 text-sm text-gray-600">
          Click Edit to update an entry or Delete to remove it.
        </div>

        <div className="mt-6 space-y-3">
          {sortedRows.map((row) => (
            <div key={row.id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{row.title || "Revenue Entry"}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(row.revenue_type || row.type || "other")} · {(row.frequency || "one_time")} · {(row.source || "manual")}
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {money(row.amount)} · {dateInputValue(row.recognized_on || row.entry_date) || "N/A"} · {row.status || (row.paid ? "received" : "pending")}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(row.id)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!sortedRows.length ? (
            <div className="text-sm text-gray-600">No revenue entries yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Input(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{props.label}</label>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}

function DateInput(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{props.label}</label>
      <input
        type="date"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{props.label}</label>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      >
        {props.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}