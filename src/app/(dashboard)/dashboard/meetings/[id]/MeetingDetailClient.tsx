"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MeetingDetailClient({
  meetingId,
  initialNotes,
}: {
  meetingId: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || `Failed (${res.status})`);
        setSaving(false);
        return;
      }

      setMsg("Saved ✅");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-xl border p-2 text-sm"
        rows={8}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type your meeting notes here..."
      />

      <div className="flex items-center gap-3">
        <button
          className="rounded-2xl border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Notes"}
        </button>

        {msg ? <div className="text-sm text-gray-700">{msg}</div> : null}
      </div>
    </div>
  );
}