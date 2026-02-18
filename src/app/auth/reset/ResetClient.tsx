"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

export default function ResetClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Optional: allow deep link redirect after reset
  const nextUrl = sp.get("next") || "/dashboard";

  useEffect(() => {
    // If the user lands here without a valid recovery session,
    // Supabase may not allow updateUser. We'll still show UI and let them try.
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!password || password.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Password updated. Redirecting…");
    setTimeout(() => router.replace(nextUrl), 900);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md fw-card-strong p-7">
        <div className="text-xl font-semibold text-gray-900">Set your password</div>
        <div className="mt-1 text-sm text-gray-600">
          Choose a new password to finish setup.
        </div>

        <form onSubmit={onSave} className="mt-6 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900">New password</label>
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900">Confirm password</label>
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          {msg ? (
            <div className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-gray-800">
              {msg}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save password"}
          </button>

          <button
            type="button"
            onClick={() => router.replace("/portal")}
            className="w-full h-11 rounded-xl border border-black/10 bg-white text-sm font-semibold"
          >
            Back to portal
          </button>
        </form>
      </div>
    </main>
  );
}
