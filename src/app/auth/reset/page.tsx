"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const nextUrl = searchParams.get("next") || "/dashboard";

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Step 1: capture session from recovery link
  useEffect(() => {
    let mounted = true;

    (async () => {
      setErr(null);
      setMsg(null);

      try {
        // Some recovery links return tokens in the URL hash (#access_token=...)
        // supabase-js v2 supports this helper in browser:
        // It will parse URL + store session automatically.
        // If it’s not present in your build for some reason, the fallback below still works.
        const anyAuth: any = supabase.auth as any;

        if (typeof anyAuth.getSessionFromUrl === "function") {
          const { data, error } = await anyAuth.getSessionFromUrl({ storeSession: true });
          if (!mounted) return;

          if (error) {
            setChecking(false);
            setErr(error.message);
            return;
          }

          // If session exists, we’re ready to set password
          if (data?.session) {
            setChecking(false);
            setReady(true);
            return;
          }
        }

        // Fallback: if the above helper doesn’t exist, try normal session fetch
        const { data: s } = await supabase.auth.getSession();
        if (!mounted) return;

        setChecking(false);
        setReady(!!s.session);
        if (!s.session) setErr("Recovery session not found. Please request a new reset link.");
      } catch (e: any) {
        if (!mounted) return;
        setChecking(false);
        setErr(e?.message || "Unable to load reset session.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSave() {
    setErr(null);
    setMsg(null);

    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Password updated. Redirecting...");
    router.replace(nextUrl);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-gray-50 via-white to-white">
      <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold text-gray-900">Set your password</div>
        <div className="mt-1 text-sm text-gray-600">
          Create a new password to access Freshware.
        </div>

        {checking ? (
          <div className="mt-6 text-sm text-gray-600">Checking reset link…</div>
        ) : !ready ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err || "Reset link is not valid or expired. Please request a new one."}
            <div className="mt-3">
              <Link className="underline font-semibold" href={`/portal?next=${encodeURIComponent(nextUrl)}`}>
                Back to portal
              </Link>
            </div>
          </div>
        ) : (
          <>
            {msg ? (
              <div className="mt-4 rounded-2xl border bg-white p-3 text-sm font-semibold text-gray-900 shadow-sm">
                {msg}
              </div>
            ) : null}

            {err ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">New password</label>
                <input
                  className="w-full rounded-2xl border bg-white px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Confirm password</label>
                <input
                  className="w-full rounded-2xl border bg-white px-3 py-2 text-sm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="w-full rounded-2xl bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save password"}
              </button>

              <div className="pt-2 text-xs text-gray-500">
                Tip: If this link expired, go back to the portal and request a new reset link.
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
