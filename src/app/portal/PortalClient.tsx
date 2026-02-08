"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

export default function PortalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nextUrl = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        setChecking(false);
        return;
      }

      if (data.session) {
        router.replace(nextUrl);
        return;
      }

      setChecking(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [router, nextUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace(nextUrl);
  }

  async function onSendMagicLink() {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          nextUrl
        )}`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setError("Magic link sent. Check your email.");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-muted-foreground">Checking session...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Freshware Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to access your dashboard.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={onSendMagicLink}
            disabled={loading || !email}
            className="w-full rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send magic link instead"}
          </button>

          <div className="pt-2 text-xs text-muted-foreground">
            Tip: Add a deep link using ?next=/dashboard/opportunities
          </div>
        </form>
      </div>
    </main>
  );
}
