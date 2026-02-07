"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PageShell } from "@/components/PortalChrome";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

const supabase = supabaseBrowser();

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // inline login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id ?? null;

      if (!mounted) return;
      setAuthedUserId(userId);

      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, role, account_id")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;
      setProfile((prof as Profile) ?? null);
      setLoading(false);
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const displayName = useMemo(() => {
    const name = (profile?.full_name ?? "").trim();
    if (!name) return "there";
    return name.split(" ")[0] || "there";
  }, [profile?.full_name]);

  const roleLower = useMemo(() => (profile?.role ?? "").toLowerCase(), [profile?.role]);
  const isAdmin = roleLower === "ceo" || roleLower === "admin";

  async function doLogin() {
    setMsg(null);
    setResetSent(false);

    if (!email.trim().includes("@") || password.length < 6) {
      setMsg("Enter a valid email and password.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // Auth change listener will re-render the logged-in view
    router.refresh();
  }

  async function doForgotPassword() {
    setMsg(null);
    setResetSent(false);

    if (!email.trim().includes("@")) {
      setMsg("Enter your email first, then click Forgot password.");
      return;
    }

    setBusy(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setResetSent(true);
    setMsg("Password reset email sent. Check your inbox.");
  }

  async function doLogout() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    router.refresh();
  }

  // loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-44 rounded bg-gray-200 animate-pulse" />
          <div className="mt-3 h-4 w-full rounded bg-gray-200 animate-pulse" />
          <div className="mt-6 h-11 w-full rounded-2xl bg-gray-200 animate-pulse" />
          <div className="mt-3 h-11 w-full rounded-2xl bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  // Logged-in lobby (keep simple, matches portal style)
  if (authedUserId) {
    return (
      <PageShell
        headerRight={
          <>
            <Link
              href="/dashboard"
              className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
            >
              Dashboard
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
              >
                Admin
              </Link>
            )}
            <button
              onClick={doLogout}
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90 disabled:opacity-50"
              disabled={busy}
            >
              Logout
            </button>
          </>
        }
      >
        <section className="pt-10">
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="inline-flex items-center rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              {isAdmin ? "Team Portal" : "Client Portal"}
            </div>

            <h1 className="mt-4 text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
              Welcome back, {displayName}
            </h1>

            <p className="mt-3 text-base text-gray-600 max-w-2xl">
              This workspace is data-driven by design. Use it to stay aligned on progress, next steps, and collaboration.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
              >
                Go to dashboard
              </Link>
              <Link
                href="/meetings"
                className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
              >
                Meetings
              </Link>
              <Link
                href="/tasks"
                className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
              >
                Tasks
              </Link>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  // Logged-out portal entry with inline login
  return (
    <PageShell
      headerRight={
        <>
          <Link
            href="/request-access"
            className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
          >
            Request access
          </Link>
        </>
      }
    >
      <section className="pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900">
              A data-driven workspace for modern teams and clients.
            </h1>

            <p className="mt-4 text-lg text-gray-600">
              Access your projects, meetings, tasks, and updates in one secure portal. Built to help organizations operate
              with clarity, consistency, and confidence without guesswork.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCard title="Secure access" body="Invite-only workspace access for teams and clients." />
              <InfoCard title="Clear workflow" body="Projects, meetings, tasks, and updates in one place." />
              <InfoCard title="Data-driven" body="Turn daily activity into clarity and accountability." />
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Log in</div>
            <div className="mt-1 text-sm text-gray-600">
              Enter your credentials to access your workspace.
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <label className="block">
                <div className="text-sm font-semibold text-gray-900">Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <div className="text-sm font-semibold text-gray-900">Password</div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Your password"
                  type="password"
                  autoComplete="current-password"
                />
              </label>

              {msg && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    resetSent ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {msg}
                </div>
              )}

              <button
                onClick={doLogin}
                disabled={busy}
                className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Working..." : "Log in"}
              </button>

              <button
                onClick={doForgotPassword}
                disabled={busy}
                className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Forgot password
              </button>

              <Link
                href="/request-access"
                className="block text-center rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
              >
                Request access
              </Link>

              <div className="mt-2 text-xs text-gray-500">
                Invite-only: if you don’t have access, request an invitation. If you forgot your password, enter your email above and click Forgot password.
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function InfoCard(props: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border bg-gray-50 p-5">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}
