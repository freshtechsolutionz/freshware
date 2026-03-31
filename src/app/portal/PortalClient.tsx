"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

function getSafeNext(next: string | null) {
  if (!next) return "/dashboard";

  // prevent redirect loops
  if (
    next.startsWith("/portal") ||
    next.startsWith("/login") ||
    next === "/"
  ) {
    return "/dashboard";
  }

  return next;
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

  const nextUrl = getSafeNext(searchParams.get("next"));

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        router.replace(nextUrl);
        return;
      }

      setChecking(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, nextUrl]);

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

    router.replace("/dashboard");
    router.refresh();
  }

  async function onForgotPassword() {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setError("Enter your email above first.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const origin = window.location.origin;
    const redirectTo = `${origin}/portal/setup`;

    const { error } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password reset email sent.");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-gray-600">Checking session...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md fw-card-strong p-7">
        <div className="text-xl font-semibold text-gray-900">
          Freshware Portal
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />

          <input
            className="w-full rounded-xl border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <button className="w-full bg-black text-white py-2 rounded-xl">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}