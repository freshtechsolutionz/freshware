"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

function getSafeNext(next: string | null) {
  const fallback = "/dashboard";
  if (!next) return fallback;

  const clean = next.trim();
  if (!clean.startsWith("/")) return fallback;
  if (clean === "/") return fallback;
  if (clean.startsWith("/portal")) return fallback;
  if (clean.startsWith("/login")) return fallback;
  if (clean.startsWith("/signup")) return fallback;
  if (clean.startsWith("/request-access")) return fallback;

  return clean;
}

export default function PortalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextUrl = useMemo(() => getSafeNext(searchParams.get("next")), [searchParams]);

  useEffect(() => {
  let mounted = true;

  const timeout = setTimeout(() => {
    if (mounted) {
      setChecking(false);
    }
  }, 2500);

  (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      clearTimeout(timeout);

      if (session?.user) {
        window.location.href = nextUrl;
        return;
      }

      setChecking(false);
    } catch (err) {
      console.error("Portal session error", err);

      if (!mounted) return;

      clearTimeout(timeout);

      try {
        localStorage.removeItem("supabase.auth.token");
        sessionStorage.clear();
      } catch {}

      setChecking(false);
    }
  })();

  return () => {
    mounted = false;
    clearTimeout(timeout);
  };
}, [nextUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace(nextUrl || "/dashboard");
    router.refresh();
  }

  async function onForgotPassword() {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setError("Enter your email above first, then click Forgot password / Set password.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const origin = window.location.origin;
    const redirectTo = `${origin}/portal/setup`;

    const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password reset email sent. Check your inbox.");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="text-sm text-gray-600">Checking session...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md fw-card-strong p-7">
        <div className="text-xl font-semibold text-gray-900">Freshware Portal</div>
        <div className="mt-1 text-sm text-gray-600">Sign in to access your dashboard.</div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900">Email</label>
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900">Password</label>
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {message ? (
            <div className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-gray-800">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={onForgotPassword}
            disabled={loading}
            className="w-full h-11 rounded-xl border border-black/10 bg-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Sending..." : "Forgot password / Set password"}
          </button>

          <Link
            href="/request-access"
            className="w-full h-11 rounded-xl border border-black/10 bg-white text-sm font-semibold flex items-center justify-center hover:bg-gray-50"
          >
            Request access
          </Link>

          <div className="pt-2 text-xs text-gray-500 text-center">
            Need access? Request an invitation. Already invited? Use your email above and click
            “Forgot password / Set password” to finish setup.
          </div>
        </form>
      </div>
    </main>
  );
}