"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

const supabase = supabaseBrowser();

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const n = (profile?.full_name ?? "").trim();
    return n ? n.split(" ")[0] : "there";
  }, [profile?.full_name]);

  const isAdmin = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    return r === "ceo" || r === "admin";
  }, [profile?.role]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setErrorMsg(null);
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setProfile((prof as Profile) ?? null);
      setLoading(false);
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="mt-4 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
          <div className="mt-3 h-24 w-full rounded-2xl bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white p-6">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold text-gray-900">Admin</div>
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white p-6">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold text-gray-900">Admin</div>
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            You do not have access to this page.
          </div>
          <div className="mt-5">
            <Link href="/dashboard" className="inline-flex rounded-2xl border px-4 py-2 text-sm font-semibold">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Access Requests",
      desc: "Review new access requests and approve pending users.",
      href: "/admin/access-requests",
      tag: "People",
    },
    {
      title: "User Manager",
      desc: "Update roles, invite users, and support account access.",
      href: "/admin/users",
      tag: "Permissions",
    },
    {
      title: "System Health",
      desc: "Check analytics, executive reports, and launch-critical visibility.",
      href: "/dashboard/reports/analytics",
      tag: "Launch",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-2xl font-semibold text-gray-900">Admin Panel</div>
              <div className="mt-1 text-sm text-gray-600">
                Welcome back, {displayName}. Manage people, permissions, and launch readiness from one place.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard" className="inline-flex rounded-2xl border px-4 py-2 text-sm font-semibold">
                Dashboard
              </Link>
              <Link href="/dashboard/reports/weekly" className="inline-flex rounded-2xl border px-4 py-2 text-sm font-semibold">
                Weekly Report
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-black/10 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  {card.tag}
                </span>
                <span className="text-sm text-gray-400 group-hover:text-gray-700">Open</span>
              </div>

              <div className="mt-5 text-lg font-semibold text-gray-900">{card.title}</div>
              <div className="mt-2 text-sm leading-6 text-gray-600">{card.desc}</div>
            </Link>
          ))}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Admin Notes</div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-gray-50 p-4 text-sm text-gray-700">
              Use <span className="font-semibold">Access Requests</span> to clear onboarding friction before launch.
            </div>
            <div className="rounded-2xl border border-black/10 bg-gray-50 p-4 text-sm text-gray-700">
              Use <span className="font-semibold">User Manager</span> for role corrections, invites, and account clean-up.
            </div>
            <div className="rounded-2xl border border-black/10 bg-gray-50 p-4 text-sm text-gray-700">
              Use <span className="font-semibold">System Health</span> to spot reporting or visibility issues before clients see them.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}