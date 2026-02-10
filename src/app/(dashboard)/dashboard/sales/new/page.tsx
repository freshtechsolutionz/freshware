// src/app/dashboard/sales/new/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { SALES_STAGES, SERVICE_LINES, formatServiceLine } from "@/lib/salesConfig";

export default function NewOpportunityPage() {
  const [name, setName] = useState("");
  const [stage, setStage] = useState<(typeof SALES_STAGES)[number]>(SALES_STAGES[0]);
  const [serviceLine, setServiceLine] = useState<(typeof SERVICE_LINES)[number]>(SERVICE_LINES[0]);
  const [amount, setAmount] = useState<string>("");

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const payload = {
    name,
    stage,
    serviceLine,
    amount: amount ? Number(amount) : 0,
  };

  const res = await fetch("/api/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (!res.ok) {
    alert("❌ Failed to save:\n" + (json?.error || "Unknown error"));
    return;
  }

  alert("✅ Saved to Supabase:\n\n" + JSON.stringify(json.opportunity, null, 2));

  setName("");
  setStage(SALES_STAGES[0]);
  setServiceLine(SERVICE_LINES[0]);
  setAmount("");
}


  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Add Opportunity</h1>
        <Link href="/dashboard/sales">← Back to Sales</Link>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Opportunity Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Example: Jack & Jill Pitch Workshop (New Orleans)"
            required
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Stage</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as any)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            {SALES_STAGES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Service Line</span>
          <select
            value={serviceLine}
            onChange={(e) => setServiceLine(e.target.value as any)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            {SERVICE_LINES.map((l) => (
              <option key={l} value={l}>
                {formatServiceLine(l)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Estimated Amount ($)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Example: 2500"
            inputMode="numeric"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Save Opportunity (Step 3)
        </button>

        <p style={{ opacity: 0.7, fontSize: 13 }}>
          Note: In Step 3 we’re not saving to Supabase yet — we’re proving the form + config wiring works.
        </p>
      </form>
    </div>
  );
}
