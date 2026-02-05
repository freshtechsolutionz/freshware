"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type PortalBrand = {
  productName: string;
  portalLabel: string;
  headline: string;
  subhead: string;
  supportEmail: string;
};

const brand: PortalBrand = {
  productName: "Freshware",
  portalLabel: "Client & Team Portal",
  headline: "A data-driven workspace for modern teams and clients.",
  subhead:
    "Access your projects, meetings, tasks, and updates in one secure portal. Built to help organizations operate with clarity, consistency, and confidence without guesswork.",
  supportEmail: "support@freshware.io",
};

const supabase = supabaseBrowser();

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="mt-3 h-4 w-full rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 h-4 w-5/6 rounded bg-gray-200 animate-pulse" />
          <div className="mt-6 h-11 w-full rounded-2xl bg-gray-200 animate-pulse" />
          <div className="mt-3 h-11 w-full rounded-2xl bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  // If logged in, show a simple portal lobby, not a dashboard
  if (authedUserId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
        <Header authed onLogout={async () => { await supabase.auth.signOut(); router.refresh(); }} />
        <main className="mx-auto max-w-6xl px-6 pb-16">
          <section className="pt-10">
            <div className="rounded-3xl border bg-white p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div>
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

                <div className="w-full lg:w-[420px] rounded-3xl border bg-gray-50 p-6">
                  <div className="text-sm font-semibold text-gray-900">Quick navigation</div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <LobbyLink title="Opportunities" desc="Stages, value, and next steps." href="/opportunities" />
                    <LobbyLink title="Activities" desc="Calls, texts, emails, notes, meetings." href="/activities" />
                    <LobbyLink title="Contacts" desc="People, context, and history." href="/contacts" />
                    {isAdmin && <LobbyLink title="Admin" desc="Users, roles, access requests." href="/admin" />}
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Need help?</div>
              <div className="mt-2 text-sm text-gray-600">
                If you are having trouble accessing your workspace, contact support.
              </div>
              <div className="mt-4">
                <a
                  className="inline-flex rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  href={`mailto:${brand.supportEmail}`}
                >
                  {brand.supportEmail}
                </a>
              </div>
            </section>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // Logged out portal entry page
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <section className="pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="rounded-3xl border bg-white p-8 shadow-sm">
              <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900">
                {brand.headline}
              </h1>

              <p className="mt-4 text-lg text-gray-600">
                {brand.subhead}
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoCard title="Secure access" body="Invite-only workspace access for teams and clients." />
                <InfoCard title="Clear workflow" body="Projects, meetings, tasks, and updates in one place." />
                <InfoCard title="Data-driven" body="Built to help organizations operate with clarity." />
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-8 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Log in</div>
              <div className="mt-1 text-sm text-gray-600">
                Enter your credentials to access your workspace.
              </div>

              <div className="mt-6 space-y-3">
                <Link
                  href="/login"
                  className="block w-full text-center rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
                >
                  Log in
                </Link>
                <Link
                  href="/request-access"
                  className="block w-full text-center rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                >
                  Request access
                </Link>
                <Link
                  href="/login"
                  className="block text-center text-sm font-semibold text-gray-700 hover:text-gray-900"
                >
                  Forgot your password?
                </Link>
              </div>

              <div className="mt-8 rounded-3xl border bg-gray-50 p-5">
                <div className="text-sm font-semibold text-gray-900">Invite-only</div>
                <div className="mt-1 text-sm text-gray-600">
                  If you have been asked to collaborate or need access to your organization’s workspace, request an invitation.
                </div>
              </div>

              <div className="mt-6 text-sm text-gray-600">
                Need help?{" "}
                <a className="font-semibold text-gray-900" href={`mailto:${brand.supportEmail}`}>
                  Contact support
                </a>
              </div>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">What you can do in Freshware</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <MiniFeature title="Stay aligned" body="Keep everyone aligned on meetings, updates, and next steps." />
              <MiniFeature title="Keep it organized" body="Centralize tasks, contacts, and progress in one workspace." />
              <MiniFeature title="Operate data-driven" body="Turn day-to-day activity into clarity and accountability." />
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Header(props: { authed?: boolean; onLogout?: () => void }) {
  return (
    <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
          F
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{brand.productName}</div>
          <div className="text-sm text-gray-600">{brand.portalLabel}</div>
        </div>
      </Link>

      <nav className="flex items-center gap-3">
        {!props.authed ? (
          <>
            <Link
              href="/login"
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white border border-transparent hover:border-gray-200"
            >
              Log in
            </Link>
            <Link
              href="/request-access"
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
            >
              Request access
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/dashboard"
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white border border-transparent hover:border-gray-200"
            >
              Dashboard
            </Link>
            <button
              onClick={props.onLogout}
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
            >
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 pb-10 pt-10 text-sm text-gray-600">
      <div className="rounded-3xl border bg-white p-6 shadow-sm flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Powered by Freshware</div>
          <div className="mt-1 text-sm text-gray-600">Data-driven by design.</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:${brand.supportEmail}`}
            className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Support
          </a>
          <Link
            href="/login"
            className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Log in
          </Link>
          <Link
            href="/request-access"
            className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
          >
            Request access
          </Link>
        </div>
      </div>
      <div className="mt-6 text-xs text-gray-500">© {new Date().getFullYear()} Freshware. All rights reserved.</div>
    </footer>
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

function MiniFeature(props: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border bg-gray-50 p-6">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}

function LobbyLink(props: { title: string; desc: string; href: string }) {
  return (
    <Link href={props.href} className="rounded-3xl border bg-white p-4 hover:bg-gray-50 transition">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.desc}</div>
    </Link>
  );
}
