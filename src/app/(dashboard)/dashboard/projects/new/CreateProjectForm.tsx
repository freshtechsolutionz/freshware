"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateProjectForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [stage, setStage] = useState("Intake");
  const [status, setStatus] = useState("Active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stage, status }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json?.error || "Failed to create project.");
      setSaving(false);
      return;
    }

    router.push("/dashboard/projects");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm max-w-xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Project Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mt-1"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mt-1"
          >
            <option>Intake</option>
            <option>Discovery</option>
            <option>Design</option>
            <option>Development</option>
            <option>QA</option>
            <option>Launch</option>
            <option>Maintenance</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mt-1"
          >
            <option>Active</option>
            <option>On Hold</option>
            <option>Completed</option>
          </select>
        </div>

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded-lg"
        >
          {saving ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
