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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
        <header className="mx-auto max-w-4xl px-6 py-6">
          <Link href="/" className="text-sm font-semibold text-gray-900 hover:underline">
            Back to portal entry
          </Link>
        </header>
        <main className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-2xl font-semibold text-gray-900">Admin</div>
            <div className="mt-2 text-sm text-gray-600">
              You do not have permission to view this area.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">Admin</div>
          <div className="mt-1 text-sm text-gray-600">Welcome, {displayName}.</div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Portal entry
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {errorMsg && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Admin tools</div>
          <div className="mt-2 text-sm text-gray-600">
            Manage invite-only onboarding and internal configuration.
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminTile
              title="Access Requests"
              body="Review invite-only requests and approve or deny access."
              href="/admin/access-requests"
            />

            <AdminTile
              title="Users and Roles"
              body="Coming next: manage users, roles, and account assignments."
              href="/admin"
              disabled
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminTile(props: { title: string; body: string; href: string; disabled?: boolean }) {
  if (props.disabled) {
    return (
      <div className="rounded-3xl border bg-gray-50 p-6 opacity-70">
        <div className="text-base font-semibold text-gray-900">{props.title}</div>
        <div className="mt-2 text-sm text-gray-600">{props.body}</div>
        <div className="mt-4 text-sm font-semibold text-gray-500">Coming soon</div>
      </div>
    );
  }

  return (
    <Link href={props.href} className="rounded-3xl border bg-white p-6 hover:bg-gray-50 transition shadow-sm">
      <div className="text-base font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
      <div className="mt-4 text-sm font-semibold text-gray-900">Open</div>
    </Link>
  );
}
