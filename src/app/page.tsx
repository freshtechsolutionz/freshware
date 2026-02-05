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
  tagline: string;
  supportEmail: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
};

const brand: PortalBrand = {
  productName: "Freshware",
  tagline: "The master portal for pipeline, meetings, tasks, and client operations.",
  supportEmail: "support@freshtechsolutionz.com",
  primaryCtaLabel: "Sign up",
  secondaryCtaLabel: "Log in",
};

// Tip for whitelabel later
// Replace this with a DB-driven tenant config by hostname
// example: portal_config table keyed by domain

const supabase = supabaseBrowser();

function classNames(...v: Array<string | false | null | undefined>) {
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
        // Keep user signed in even if profile fetch fails
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="mt-4 h-3 w-full rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 h-3 w-5/6 rounded bg-gray-200 animate-pulse" />
          <div className="mt-6 h-10 w-full rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  // Logged out landing
  if (!authedUserId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
              F
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{brand.productName}</div>
              <div className="text-sm text-gray-600">Master Portal</div>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              {brand.secondaryCtaLabel}
            </Link>
            <Link
              href="/signup"
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
            >
              {brand.primaryCtaLabel}
            </Link>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-16">
          <section className="pt-10 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900">
                  One portal for your pipeline, operations, and client success
                </h1>
                <p className="mt-4 text-lg text-gray-600">
                  {brand.tagline}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="rounded-xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
                  >
                    Create an account
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl px-5 py-3 text-sm font-semibold border border-gray-300 text-gray-900 hover:bg-gray-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    View dashboard
                  </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ValueCard title="Pipeline clarity" body="See deal stages, velocity, and stuck opportunities at a glance." />
                  <ValueCard title="Activity tracking" body="Log calls, texts, emails, notes, and meetings in seconds." />
                  <ValueCard title="Client-ready" body="A clean portal your clients can use without extra training." />
                  <ValueCard title="Whitelabel ready" body="Swap branding by customer with a single config." />
                </div>
              </div>

              <div className="rounded-3xl border bg-white shadow-sm p-6">
                <div className="text-sm font-semibold text-gray-900">Preview</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <PreviewTile label="Sales Pipeline" />
                  <PreviewTile label="Meetings" />
                  <PreviewTile label="Tasks" />
                  <PreviewTile label="Reports" />
                </div>
                <div className="mt-6 rounded-2xl bg-gray-50 p-4 border">
                  <div className="text-xs font-semibold text-gray-700">Portal Promise</div>
                  <div className="mt-2 text-sm text-gray-600">
                    Built for internal teams and clients. Designed to scale as a whitelabeled platform.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-10 border-t pt-8 text-sm text-gray-600 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} {brand.productName}. All rights reserved.</div>
            <div className="flex gap-4">
              <a className="hover:text-gray-900" href={`mailto:${brand.supportEmail}`}>Support</a>
              <Link className="hover:text-gray-900" href="/login">Log in</Link>
              <Link className="hover:text-gray-900" href="/signup">Sign up</Link>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  // Logged in portal
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
            F
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{brand.productName}</div>
            <div className="text-sm text-gray-600">Master Portal</div>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white border border-transparent hover:border-gray-200">
            Dashboard
          </Link>
          <Link href="/opportunities" className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white border border-transparent hover:border-gray-200">
            Opportunities
          </Link>
          <Link href="/meetings" className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white border border-transparent hover:border-gray-200">
            Meetings
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.refresh();
            }}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {displayName}</h1>
              <p className="mt-1 text-sm text-gray-600">
                Your portal for tracking deals, activities, meetings, and next steps.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/opportunities/new" className="rounded-xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90">
                Create opportunity
              </Link>
              <Link href="/activities/new" className="rounded-xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
                Log activity
              </Link>
              <Link href="/meetings/new" className="rounded-xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
                Schedule meeting
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PortalTile title="Sales Pipeline" body="Stage view, stuck deals, weighted pipeline." href="/dashboard" />
            <PortalTile title="Accounts and Contacts" body="Manage organizations, stakeholders, and notes." href="/accounts" />
            <PortalTile title="Tasks and Follow-ups" body="Never lose track of next steps and ownership." href="/tasks" />
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">Navigate</div>
                  <div className="text-sm text-gray-600">Go where you need in one click.</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionTile label="Opportunities" desc="Create, update stages, manage pipeline." href="/opportunities" />
                <ActionTile label="Activities" desc="Calls, texts, emails, notes, meetings." href="/activities" />
                <ActionTile label="Meetings" desc="Schedule, track, and log follow-ups." href="/meetings" />
                <ActionTile label="Reports" desc="KPIs, stuck deals, forecasting." href="/reports" />
                <ActionTile label="Contacts" desc="People you work with and their history." href="/contacts" />
                {isAdmin && <ActionTile label="Admin" desc="Users, roles, portal configuration." href="/admin" />}
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Announcements</div>
              <div className="mt-2 text-sm text-gray-600">
                This area will pull from a table later. For now it is a clean space to post updates to employees and clients.
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Announcement title="Log activities as you go" body="Use Log activity after calls, texts, and emails to keep KPI data accurate." />
                <Announcement title="Meetings auto-log plan" body="We will add opportunity_id to meetings so completed meetings create activity automatically." />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Quick help</div>
              <div className="mt-2 text-sm text-gray-600">
                Need support or onboarding help?
              </div>

              <div className="mt-4 space-y-2">
                <a className="block rounded-xl border p-3 hover:bg-gray-50" href={`mailto:${brand.supportEmail}`}>
                  <div className="text-sm font-semibold text-gray-900">Contact support</div>
                  <div className="text-xs text-gray-600">{brand.supportEmail}</div>
                </a>
                <Link className="block rounded-xl border p-3 hover:bg-gray-50" href="/docs">
                  <div className="text-sm font-semibold text-gray-900">View portal guide</div>
                  <div className="text-xs text-gray-600">How to use pipeline, meetings, and tasks.</div>
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Your access</div>
              <div className="mt-2 text-sm text-gray-600">
                Role: <span className="font-semibold text-gray-900">{profile?.role ?? "unknown"}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Account context will display here once we load account names from accountsMap.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ValueCard(props: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}

function PreviewTile(props: { label: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-sm font-semibold text-gray-900">{props.label}</div>
      <div className="mt-2 h-2 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-2 w-2/3 rounded bg-gray-200" />
    </div>
  );
}

function PortalTile(props: { title: string; body: string; href: string }) {
  return (
    <Link href={props.href} className="rounded-2xl border p-4 hover:bg-gray-50 transition">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.body}</div>
      <div className="mt-3 text-sm font-semibold text-gray-900">Open</div>
    </Link>
  );
}

function ActionTile(props: { label: string; desc: string; href: string }) {
  return (
    <Link href={props.href} className="rounded-2xl border p-4 hover:bg-gray-50 transition">
      <div className="text-sm font-semibold text-gray-900">{props.label}</div>
      <div className="mt-1 text-sm text-gray-600">{props.desc}</div>
    </Link>
  );
}

function Announcement(props: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}
