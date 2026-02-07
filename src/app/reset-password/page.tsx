"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PageShell } from "@/components/PortalChrome";

const supabase = supabaseBrowser();

export default function ResetPasswordPage() {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // When user clicks the email link, Supabase sets a session in the browser.
    // This page just needs to call updateUser with the new password.
  }, []);

  async function setPassword() {
    setMsg(null);
    setOk(false);

    if (pw1.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setMsg("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setOk(true);
    setMsg("Password updated. You can log in now.");
  }

  return (
    <PageShell
      headerRight={
        <Link
          href="/"
          className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
        >
          Portal entry
        </Link>
      }
    >
      <section className="pt-12 max-w-xl">
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Set a new password</h1>
          <p className="mt-3 text-sm text-gray-600">
            Enter your new password below. After saving, return to the portal entry page to log in.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3">
            <label className="block">
              <div className="text-sm font-semibold text-gray-900">New password</div>
              <input
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                type="password"
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-gray-900">Confirm new password</div>
              <input
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                type="password"
              />
            </label>

            {msg && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {msg}
              </div>
            )}

            <button
              onClick={setPassword}
              disabled={busy}
              className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working..." : "Update password"}
            </button>

            <Link
              href="/"
              className="text-center rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
            >
              Return to portal entry
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
