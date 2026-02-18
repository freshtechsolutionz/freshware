"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function PortalSetupPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // If they clicked an invite/recovery link, Supabase should have created a session.
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setMsg(error.message);
        setChecking(false);
        return;
      }

      if (!data.session) {
        setMsg("Your setup link is missing or expired. Go back to Portal and click “Forgot password / Set password”.");
        setChecking(false);
        return;
      }

      setChecking(false);
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setMsg("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // After password is set, send them to dashboard (or profile completion later)
    router.replace("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-gray-600">Checking setup link…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md fw-card-strong p-7">
        <div className="text-xl font-semibold text-gray-900">Set your password</div>
        <div className="mt-1 text-sm text-gray-600">
          Create a password to activate your Freshware account.
        </div>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-3 text-sm text-gray-800">
            {msg}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save password"}
          </button>

          <div className="text-xs text-gray-500">
            If this link expired, go back to the Portal and use “Forgot password / Set password”.
          </div>
        </form>
      </div>
    </main>
  );
}
