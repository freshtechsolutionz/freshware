"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Viewer = {
  email: string | null;
  full_name: string | null;
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
  const [viewer, setViewer] = useState<Viewer>({ email: null, full_name: null });

  useEffect(() => {
    const supabase = supabaseBrowser();

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const email = user.email ?? null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setViewer({
        email,
        full_name: (profile as any)?.full_name ?? null,
      });
    })();
  }, []);

  const initials = useMemo(
    () => initialsFromName(viewer.full_name || viewer.email),
    [viewer.full_name, viewer.email]
  );

  async function handleLogout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/portal");
    router.refresh();
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[999] border-b border-black/10 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto relative flex h-24 max-w-7xl items-center px-6">
        <div className="min-w-[220px]" />

        <div className="absolute left-1/2 -translate-x-1/2">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/brand/freshware-logo.png?v=2026"
              alt="Freshware"
              width={900}
              height={220}
              priority
              className="h-16 w-auto"
              unoptimized
            />
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-semibold text-gray-900">
              {viewer.full_name || "Freshware User"}
            </div>
            <div className="text-xs text-gray-600">{viewer.email || ""}</div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-semibold text-gray-900">
            {initials}
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            type="button"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
