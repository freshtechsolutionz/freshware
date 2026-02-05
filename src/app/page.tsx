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
  tagline: string;
  supportEmail: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
};

const brand: PortalBrand = {
  productName: "Freshware",
  portalLabel: "Master Portal",
  tagline:
    "A data driven operations hub for pipeline, meetings, tasks, and client success built for teams and clients.",
  supportEmail: "support@freshtechsolutionz.com",
  primaryCtaLabel: "Sign up",
  secondaryCtaLabel: "Log in",
};

// Whitelabel note: replace the above constant later with a tenant config
// loaded by hostname (portal_configs table keyed by domain).

const supabase = supabaseBrowser();

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      if (!mounted) return;

      setAuthedUserId(userId);

      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, account_id")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setProfile(null);
      } else {
        setProfile((prof as Profile) ?? null);
      }

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
    if (!profile?.full_name) return "there";
    const first = profile.full_name.trim().split(" ")[0];
    return first || "there";
  }, [profile?.full_name]);

  const isAdmin = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    return r === "ceo" || r === "admin";
  }, [profile?.role]);

  const portalModeLabel = useMemo(() => {
    if (!authedUserId) return "Public";
    return isAdmin ? "Team Portal" : "Client Portal";
  }, [authedUserId, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
              F
            </div>
            <div className="flex-1">
              <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
              <div className="mt-2 h-3 w-56 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>
          <div className="mt-6 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
          <div className="mt-3 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
            <div className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
              F
            </div>
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white border border-gray-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold text-gray-900">{brand.productName}</div>
              <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
                {brand.portalLabel}
              </span>
            </div>
            <div className="text-sm text-gray-600">{brand.tagline}</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <span className="hidden md:inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
            {portalModeLabel}
          </span>

          {!authedUserId ? (
            <>
              <Link
                href="/login"
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white border border-transparent hover:border-gray-200"
              >
                {brand.secondaryCtaLabel}
              </Link>
              <Link
                href="/signup"
                className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
              >
                {brand.primaryCtaLabel}
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
              <Link
                href="/opportunities"
                className="hidden sm:inline-flex rounded-2xl px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white border border-transparent hover:border-gray-200"
              >
                Opportunities
              </Link>
              <Link
                href="/meetings"
                className="hidden sm:inline-flex rounded-2xl px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white border border-transparent hover:border-gray-200"
              >
                Meetings
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.refresh();
                }}
                className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">{children}</main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-10 text-sm text-gray-600">
        <div className="rounded-3xl border bg-white p-6 shadow-sm flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {brand.productName} is built by Fresh Tech Solutionz
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Whitelabel ready. Client friendly. Data driven by design.
            </div>
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
              href="/signup"
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-6 text-xs text-gray-500">
          © {new Date().getFullYear()} {brand.productName}. All rights reserved.
        </div>
      </footer>
    </div>
  );

  if (!authedUserId) {
    return (
      <Shell>
        <section className="pt-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="rounded-3xl border bg-white p-8 shadow-sm">
              <div className="inline-flex items-center rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                Built by Fresh Tech Solutionz
              </div>

              <h1 className="mt-4 text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900">
                A fresh, data driven portal for modern teams and clients
              </h1>

              <p className="mt-4 text-lg text-gray-600">
                {brand.productName} brings your pipeline, meetings, tasks, and client delivery into one clean hub.
                Built to feel premium, stay simple, and scale as a whitelabeled platform.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
                >
                  Create an account
                </Link>
                <Link
                  href="/login"
                  className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 text-gray-900 hover:bg-gray-50"
                >
                  Log in
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
                >
                  View dashboard
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ValueCard title="Data driven visibility" body="See work, momentum, and follow-through without chasing updates." />
                <ValueCard title="Client-ready from day one" body="A portal that feels polished for clients and simple for teams." />
                <ValueCard title="Fast navigation" body="Everything is one click away with clear, focused modules." />
                <ValueCard title="Whitelabel ready" body="Swap branding per client without redesigning the product." />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">What you can do here</div>
                    <div className="mt-1 text-sm text-gray-600">A clean portal that stays organized as you grow.</div>
                  </div>
                  <span className="inline-flex items-center rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                    Preview
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <PreviewTile label="Dashboard" />
                  <PreviewTile label="Opportunities" />
                  <PreviewTile label="Meetings" />
                  <PreviewTile label="Tasks" />
                  <PreviewTile label="Contacts" />
                  <PreviewTile label="Reports" />
                </div>
              </div>

              <div className="rounded-3xl border bg-black p-6 shadow-sm text-white">
                <div className="text-sm font-semibold">Fresh Tech standard</div>
                <div className="mt-2 text-sm text-white/80">
                  Built to help teams move faster with clean systems, clear next steps, and a data driven rhythm.
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <DarkPill title="Simple UI" />
                  <DarkPill title="Client-first" />
                  <DarkPill title="Whitelabel" />
                </div>
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Need access?</div>
                <div className="mt-1 text-sm text-gray-600">
                  Use your portal login or create an account to get started.
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
                  >
                    Sign up
                  </Link>
                  <a
                    href={`mailto:${brand.supportEmail}`}
                    className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white border border-transparent hover:border-gray-200"
                  >
                    Contact support
                  </a>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border bg-white p-8 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <HowItWorks
                step="01"
                title="Centralize the work"
                body="Keep opportunities, meetings, tasks, and client execution organized in one place."
              />
              <HowItWorks
                step="02"
                title="Create a rhythm"
                body="Log calls, texts, emails, notes, and meetings so everyone sees the story."
              />
              <HowItWorks
                step="03"
                title="Stay ready to scale"
                body="Whitelabel the portal for any client with consistent UX and clean configuration."
              />
            </div>
          </section>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="pt-8">
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                {isAdmin ? "Team Portal" : "Client Portal"}
              </div>

              <h1 className="mt-4 text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
                Welcome back, {displayName}
              </h1>

              <p className="mt-3 text-base text-gray-600 max-w-2xl">
                This is the master portal for Fresh Tech teams and clients. Clean navigation, consistent systems, and a
                data driven foundation built to scale as a whitelabeled product.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
                >
                  Go to dashboard
                </Link>
                <Link
                  href="/opportunities"
                  className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                >
                  Opportunities
                </Link>
                <Link
                  href="/meetings"
                  className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                >
                  Meetings
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border bg-gray-50 p-6 w-full lg:w-[440px]">
              <div className="text-sm font-semibold text-gray-900">Fresh start checklist</div>
              <div className="mt-1 text-sm text-gray-600">
                Keep the portal clean and the data reliable.
              </div>
              <div className="mt-4 space-y-3">
                <MiniStep
                  title="Log every touch"
                  body="Calls, texts, emails, meetings, and notes keep the team aligned."
                />
                <MiniStep
                  title="Keep stages updated"
                  body="Move opportunities forward so the dashboard stays accurate."
                />
                <MiniStep
                  title="Assign next steps"
                  body="Use tasks to keep ownership clear and execution consistent."
                />
              </div>
            </div>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <LobbyTile
            title="Dashboard"
            body="Your main control center for visibility and alignment."
            href="/dashboard"
          />
          <LobbyTile
            title="Opportunities"
            body="Manage stages, value, and next steps in one view."
            href="/opportunities"
          />
          <LobbyTile
            title="Meetings"
            body="Schedule, track status, and drive follow-through."
            href="/meetings"
          />
          <LobbyTile
            title="Tasks"
            body="Assign ownership and keep execution consistent."
            href="/tasks"
          />
          <LobbyTile
            title="Contacts"
            body="Centralize relationships and keep history searchable."
            href="/contacts"
          />
          <LobbyTile
            title="Support"
            body="Get help, report issues, or request features."
            href="/support"
          />
          {isAdmin && (
            <LobbyTile
              title="Admin"
              body="Users, roles, and whitelabel configuration."
              href="/admin"
            />
          )}
        </section>

        <section className="mt-6 rounded-3xl border bg-black p-8 shadow-sm text-white">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <div className="text-sm font-semibold text-white/90">The Fresh Tech way</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                Clean systems. Clear ownership. Data driven execution.
              </div>
              <div className="mt-3 text-sm text-white/80 max-w-2xl">
                This portal is designed to feel premium for clients and simple for teams, while staying ready to
                whitelabel for any organization.
              </div>
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
              <div className="text-sm font-semibold">Need help?</div>
              <div className="mt-2 text-sm text-white/80">
                Contact support or open the portal guide.
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`mailto:${brand.supportEmail}`}
                  className="rounded-2xl bg-white text-black px-4 py-2 text-sm font-semibold hover:opacity-90"
                >
                  Support
                </a>
                <Link
                  href="/docs"
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/5"
                >
                  Portal guide
                </Link>
              </div>
            </div>
          </div>
        </section>
      </section>
    </Shell>
  );
}

function ValueCard(props: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}

function PreviewTile(props: { label: string }) {
  return (
    <div className="rounded-3xl border bg-gray-50 p-4">
      <div className="text-sm font-semibold text-gray-900">{props.label}</div>
      <div className="mt-3 h-2 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-2 w-2/3 rounded bg-gray-200" />
    </div>
  );
}

function DarkPill(props: { title: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold text-white/90">
      {props.title}
    </div>
  );
}

function HowItWorks(props: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border bg-gray-50 p-6">
      <div className="text-xs font-semibold text-gray-700">Step {props.step}</div>
      <div className="mt-2 text-base font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}

function LobbyTile(props: { title: string; body: string; href: string }) {
  return (
    <Link
      href={props.href}
      className="rounded-3xl border bg-white p-6 shadow-sm hover:bg-gray-50 transition"
    >
      <div className="text-base font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
      <div className="mt-4 text-sm font-semibold text-gray-900">Open</div>
    </Link>
  );
}

function MiniStep(props: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border bg-white p-4">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}
