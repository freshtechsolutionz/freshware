"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Viewer = {
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

function initialsFromName(nameOrEmail: string | null) {
  const s = (nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Topbar() {
  const router = useRouter();
  const [viewer, setViewer] = useState<Viewer>({
    email: null,
    full_name: null,
    avatar_url: null,
    role: null,
  });

  useEffect(() => {
    const supabase = supabaseBrowser();

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const email = user.email ?? null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle();

      setViewer({
        email,
        full_name: (profile as any)?.full_name ?? null,
        avatar_url: (profile as any)?.avatar_url ?? null,
        role: (profile as any)?.role ?? null,
      });
    })();
  }, []);

  const initials = useMemo(
    () => initialsFromName(viewer.full_name || viewer.email),
    [viewer.full_name, viewer.email]
  );

  const roleUpper = useMemo(() => (viewer.role || "").toUpperCase(), [viewer.role]);
  const canSeeTeam = roleUpper !== "CLIENT_USER"; // everyone except CLIENT_USER

  async function handleLogout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/portal");
    router.refresh();
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[999] border-b border-black/10 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LEFT: Logo + Nav */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/brand/freshware-logo.png?v=2026"
              alt="Freshware"
              width={900}
              height={220}
              priority
              className="h-10 w-auto"
              unoptimized
            />
          </Link>

          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/dashboard" className="text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              Dashboard
            </Link>

            <Link href="/dashboard/opportunities" className="text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              Opportunities
            </Link>

            <Link href="/dashboard/projects" className="text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              Projects
            </Link>

            <Link href="/dashboard/tasks" className="text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              Tasks
            </Link>

            {canSeeTeam ? (
              <Link href="/dashboard/team" className="text-sm font-semibold text-zinc-700 hover:text-zinc-900">
                Team
              </Link>
            ) : null}
          </nav>
        </div>

        {/* RIGHT: User */}
        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-semibold text-zinc-900">
              {viewer.full_name || "Freshware User"}
            </div>
            <div className="text-xs text-zinc-600">{viewer.email || ""}</div>
          </div>

          <Link
            href="/dashboard/profile"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white text-sm font-semibold text-zinc-900 shadow-sm"
            title="Open profile"
          >
            {viewer.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </Link>

          <button onClick={handleLogout} className="fw-btn text-sm" type="button">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
