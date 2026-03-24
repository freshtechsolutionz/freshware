"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
  avatar_url: string | null;
  created_at: string;
  email: string | null;
};

const ROLE_OPTIONS = ["CEO", "ADMIN", "STAFF", "CLIENT", "CLIENT_ADMIN", "CLIENT_USER", "PENDING"];

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [sendingResetEmail, setSendingResetEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/list-users", { method: "GET" });
      const text = await res.text();

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setLoading(false);
        setError(`Non-JSON response: ${text.slice(0, 120)}`);
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/portal?next=/admin/users");
          return;
        }
        setLoading(false);
        setError(json?.error || "Failed to load users.");
        return;
      }

      setRows((json?.users as UserRow[]) ?? []);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Failed to load users.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = normalize(`${r.full_name ?? ""} ${r.role ?? ""} ${r.email ?? ""} ${r.id ?? ""}`);
      return hay.includes(q);
    });
  }, [rows, query]);

  async function sendReset(email: string | null) {
    const clean = (email || "").trim().toLowerCase();
    if (!clean) {
      setError("This user is missing email.");
      return;
    }

    setError(null);
    setSendingResetEmail(clean);

    try {
      const res = await fetch("/api/admin/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = JSON.parse(text);
      } catch {
        setError(`Non-JSON response: ${text.slice(0, 120)}`);
        setSendingResetEmail(null);
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to send reset.");
        setSendingResetEmail(null);
        return;
      }

      setToast(`Reset email sent to ${clean}`);
    } catch (e: any) {
      setError(e?.message || "Failed to send reset.");
    } finally {
      setSendingResetEmail(null);
    }
  }

  async function updateRole(userId: string, role: string) {
    setError(null);
    setUpdatingRoleId(userId);

    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, role }),
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = JSON.parse(text);
      } catch {
        setError(`Non-JSON response: ${text.slice(0, 120)}`);
        setUpdatingRoleId(null);
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to update role");
        setUpdatingRoleId(null);
        return;
      }

      setToast("Role updated");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update role");
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function inviteUser() {
    const clean = inviteEmail.trim().toLowerCase();
    if (!clean) {
      setError("Enter an email address to invite.");
      return;
    }

    setError(null);
    setInviteBusy(true);

    try {
      const res = await fetch("/api/admin/send-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: clean,
          role: inviteRole,
        }),
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = JSON.parse(text);
      } catch {
        setError(`Non-JSON response: ${text.slice(0, 120)}`);
        setInviteBusy(false);
        return;
      }

      if (!res.ok) {
        setError(json?.error || "Failed to send invite.");
        setInviteBusy(false);
        return;
      }

      setToast(`Invite sent to ${clean}`);
      setInviteEmail("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to send invite.");
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">Users</div>
          <div className="mt-1 text-sm text-gray-600">
            Invite users, change access levels, and send password reset links.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Back to Admin
          </Link>
          <Link
            href="/dashboard"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {toast ? (
          <div className="mb-4 rounded-2xl border bg-white p-3 text-sm font-semibold text-gray-900 shadow-sm">
            {toast}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-gray-900">Invite New User</div>
          <div className="mt-1 text-sm text-gray-600">
            Send an invite by email and assign an initial access level.
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_160px]">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
            >
              {ROLE_OPTIONS.filter((r) => r !== "CEO").map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <button
              onClick={inviteUser}
              disabled={inviteBusy}
              type="button"
              className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {inviteBusy ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-gray-900">Directory</div>
              <div className="mt-1 text-sm text-gray-600">Users in your account.</div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, role, email, id"
                className="w-full md:w-[360px] rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
              <button
                onClick={load}
                className="rounded-2xl px-4 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                type="button"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 divide-y divide-black/10">
            {loading ? (
              <div className="p-4 text-sm text-gray-600">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No users found.</div>
            ) : (
              filtered.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-black/10 bg-white flex items-center justify-center text-xs font-semibold text-gray-800">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        (u.full_name || "?").slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {u.full_name || "—"}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 break-all">
                        {u.email ? (
                          <>
                            <span className="font-semibold text-gray-900">{u.email}</span>{" "}
                            <span className="text-gray-400">•</span>{" "}
                          </>
                        ) : (
                          <>
                            <span className="text-red-700 font-semibold">No email found</span>{" "}
                            <span className="text-gray-400">•</span>{" "}
                          </>
                        )}
                        Role: <span className="font-semibold text-gray-900">{u.role || "—"}</span>{" "}
                        <span className="text-gray-400">•</span> ID: <span className="font-mono">{u.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <select
                      value={u.role || "PENDING"}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      disabled={updatingRoleId === u.id}
                      className="rounded-2xl px-3 py-2 text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <Link
                      href={`/dashboard/people/${u.id}`}
                      className="rounded-2xl px-3 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                    >
                      View
                    </Link>

                    <button
                      onClick={() => sendReset(u.email)}
                      className="rounded-2xl px-3 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                      type="button"
                      disabled={sendingResetEmail === (u.email || "")}
                    >
                      {sendingResetEmail === (u.email || "") ? "Sending..." : "Send reset"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Emails are pulled from Supabase Auth server-side and never exposed to non-admin users.
          </div>
        </section>
      </main>
    </div>
  );
}