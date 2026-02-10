"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  account_id: string | null;
  created_at: string | null;
};

type AccountRow = {
  id: string;
  name: string | null;
};

const ROLE_OPTIONS = [
  "PENDING",
  "CLIENT_USER",
  "CLIENT_ADMIN",
  "STAFF",
  "SALES",
  "OPS",
  "MARKETING",
  "ADMIN",
  "CEO",
];

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [meRole, setMeRole] = useState<string>("");

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState("");

  const [workingId, setWorkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const roleUpper = String(me?.role || "").toUpperCase();
    setMeRole(roleUpper);

    if (!(roleUpper === "CEO" || roleUpper === "ADMIN")) {
      setProfiles([]);
      setAccounts([]);
      setLoading(false);
      setErrorMsg("Not authorized. Only CEO/Admin can manage users.");
      return;
    }

    const profRes = await supabase
      .from("profiles")
      .select("id, full_name, role, account_id, created_at")
      .order("created_at", { ascending: true });

    if (profRes.error) {
      setErrorMsg(profRes.error.message);
      setLoading(false);
      return;
    }

    const acctRes = await supabase.from("accounts").select("id,name").order("name", { ascending: true });

    // accounts table may exist; if it errors, we still allow manual account_id editing later
    if (!acctRes.error) setAccounts((acctRes.data as any) || []);
    else setAccounts([]);

    setProfiles((profRes.data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (!q) return true;
      const hay = `${p.full_name || ""} ${p.role || ""} ${p.id} ${p.account_id || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [profiles, search]);

  async function updateProfile(id: string, patch: Partial<ProfileRow>) {
    setWorkingId(id);
    setErrorMsg(null);

    const { error } = await supabase.from("profiles").update(patch).eq("id", id);

    setWorkingId(null);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setToast("Saved");
    await load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
        <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-gray-900">User Manager</div>
            <div className="mt-1 text-sm text-gray-600">Loading...</div>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
              Back to Admin
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-16">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="h-6 w-56 rounded bg-gray-200 animate-pulse" />
            <div className="mt-4 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
            <div className="mt-4 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = meRole === "CEO" || meRole === "ADMIN";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">User Manager</div>
          <div className="mt-1 text-sm text-gray-600">Edit users, roles, and account assignments.</div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
            Back to Admin
          </Link>
          <Link href="/dashboard" className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 space-y-4">
        {toast ? (
          <div className="rounded-2xl border bg-white p-3 text-sm font-semibold text-gray-900 shadow-sm">
            {toast}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {!isAdmin ? (
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">Not authorized</div>
            <div className="mt-2 text-sm text-gray-600">Only CEO/Admin can manage users.</div>
          </div>
        ) : (
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="text-sm text-gray-600">
                Total users: <span className="font-semibold text-gray-900">{profiles.length}</span>
              </div>

              <div className="w-full lg:w-[420px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, role, user id, account id"
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {filtered.map((p) => (
                <div key={p.id} className="rounded-3xl border bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-gray-900">{p.full_name || "Unnamed"}</div>
                      <div className="mt-1 text-xs text-gray-500 font-mono break-all">{p.id}</div>
                      <div className="mt-2 text-sm text-gray-700">
                        Role: <span className="font-semibold">{p.role}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        Account: <span className="font-mono">{p.account_id || "None"}</span>
                      </div>
                    </div>

                    <div className="w-full lg:w-[360px] space-y-3">
                      <label className="block">
                        <div className="text-xs font-semibold text-gray-700">Full name</div>
                        <input
                          defaultValue={p.full_name || ""}
                          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next === (p.full_name || "")) return;
                            updateProfile(p.id, { full_name: next || null });
                          }}
                        />
                      </label>

                      <label className="block">
                        <div className="text-xs font-semibold text-gray-700">Role</div>
                        <select
                          defaultValue={p.role}
                          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 bg-white"
                          onChange={(e) => updateProfile(p.id, { role: e.target.value })}
                          disabled={workingId === p.id}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <div className="text-xs font-semibold text-gray-700">Account assignment</div>

                        {accounts.length ? (
                          <select
                            defaultValue={p.account_id || ""}
                            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 bg-white"
                            onChange={(e) => updateProfile(p.id, { account_id: e.target.value || null })}
                            disabled={workingId === p.id}
                          >
                            <option value="">None</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name || a.id}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            defaultValue={p.account_id || ""}
                            placeholder="Paste accounts.id UUID"
                            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 font-mono"
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next === (p.account_id || "")) return;
                              updateProfile(p.id, { account_id: next || null });
                            }}
                          />
                        )}

                        <div className="mt-2 text-xs text-gray-500">
                          Choose the company account this user belongs to. Tasks, projects, and opportunities will scope to this.
                        </div>
                      </label>

                      <div className="text-xs text-gray-500">
                        {workingId === p.id ? "Saving..." : "Changes save on selection or when you click off the input."}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 ? (
                <div className="rounded-2xl border bg-gray-50 p-6 text-sm text-gray-600">
                  No users found.
                </div>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
