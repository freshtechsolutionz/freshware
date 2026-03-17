"use client";

import { useState } from "react";

export default function RevenueBackfillButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/revenue/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Backfill failed");
      }

      const s = json?.summary;
      setMsg(
        `Done. Won revenue: +${s?.oppCreated || 0} created, ${s?.oppUpdated || 0} updated. Support revenue: +${s?.projectCreated || 0} created, ${s?.projectUpdated || 0} updated.`
      );

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e: any) {
      setMsg(e?.message || "Backfill failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="fw-btn text-sm"
      >
        {busy ? "Backfilling..." : "Backfill Revenue"}
      </button>
      {msg ? <div className="text-xs text-gray-600">{msg}</div> : null}
    </div>
  );
}