"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import Image from "next/image";

const supabase = supabaseBrowser();

function cls(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

export default function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const nextUrl = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

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
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    router.replace(nextUrl);
  }

  async function onForgotPassword() {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setMsg("Enter your email above first, then click Forgot password.");
      return;
    }

    setMsg(null);
    setLoading(true);

    // If you already implemented /portal/setup flow, keep it:
    const redirectTo = `${window.location.origin}/portal/setup`;

    const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Password reset email sent. Check your inbox.");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-gray-50 via-white to-white">
        <div className="text-sm text-gray-600">Checking session...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      {/* Top bar */}
      <header className="mx-auto max-w-6xl px-6 pt-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
  <Image
    src="/brand/freshware-logo.png?v=2026"
    alt="Freshware"
    width={900}
    height={220}
    priority
    className="h-12 w-auto"
    unoptimized
  />
  <div className="leading-tight">
    <div className="text-sm text-gray-600">Client &amp; Team Portal</div>
  </div>
</div>


        <Link
          href="/request-access"
          className="h-10 px-5 rounded-full bg-black text-white text-sm font-semibold flex items-center justify-center hover:opacity-90"
        >
          Request access
        </Link>
      </header>

      {/* Body */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* LEFT marketing card */}
          <div className="rounded-3xl border border-black/10 bg-white/70 backdrop-blur p-10 shadow-sm">
            <h1 className="text-5xl font-semibold tracking-tight text-gray-900 leading-[1.05]">
              A data-driven
              <br />
              workspace for modern
              <br />
              teams and clients.
            </h1>

            <p className="mt-5 text-base text-gray-600 max-w-xl">
              Access your projects, meetings, tasks, and updates in one secure portal.
              Built to help organizations operate with clarity, consistency, and confidence
              without guesswork.
            </p>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                title="Secure access"
                body="Invite-only workspace access for teams and clients."
              />
              <FeatureCard
                title="Clear workflow"
                body="Projects, meetings, tasks, and updates in one place."
              />
              <FeatureCard
                title="Data-driven"
                body="Turn daily activity into clarity and accountability."
              />
            </div>
          </div>

          {/* RIGHT login card */}
          <div className="rounded-3xl border border-black/10 bg-white/80 backdrop-blur p-8 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">Log in</div>
            <div className="mt-1 text-sm text-gray-600">
              Enter your credentials to access your workspace.
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">Email</label>
                <input
                  className="w-full h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">Password</label>
                <input
                  className="w-full h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {msg ? (
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-gray-800">
                  {msg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-black text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>

              <button
                type="button"
                onClick={onForgotPassword}
                disabled={loading}
                className="w-full h-12 rounded-full border border-black/10 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                Forgot password
              </button>

              <Link
                href="/request-access"
                className={cls(
                  "w-full h-12 rounded-full border border-black/10 bg-white text-sm font-semibold",
                  "flex items-center justify-center hover:bg-gray-50"
                )}
              >
                Request access
              </Link>

              <div className="pt-2 text-xs text-gray-500 text-center">
  Invite-only: if you don’t have access,{" "}
  <Link href="/request-access" className="font-semibold text-black">
    request an invitation
  </Link>.
  <br />
  If you forgot your password, enter your email and click “Forgot password”.
</div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard(props: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600 leading-relaxed">{props.body}</div>
    </div>
  );
}
