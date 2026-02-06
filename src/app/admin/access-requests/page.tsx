"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type AccessRequest = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  company: string | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

const supabase = supabaseBrowser();

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function normalizeStatus(s: string) {
  const v = (s ?? "").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "denied") return "denied";
  return "new";
}

export default function AdminAccessRequestsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"new" | "approved" | "denied" | "all">("new");
  const [query, setQuery] = useState("");

  const [workingId, setWorkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setErrorMsg(null);
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      setErrorMsg(profErr.message);
      setLoading(false);
      return;
    }

    const p = (prof as Profile) ?? null;
    setProfile(p);

    const roleLower = (p?.role ?? "").toLowerCase();
    const isAdmin = roleLower === "ceo" || roleLower === "admin";

    if (!isAdmin) {
      setRows([]);
      setLoading(false);
      setErrorMsg("You do not have permission to view access requests.");
      return;
    }

    const { data, error } = await supabase
      .from("access_requests")
      .select("id, created_at, full_name, email, company, reason, status, reviewed_by, reviewed_at")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as AccessRequest[]) ?? []);
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

  const counts = useMemo(() => {
    const c = { new: 0, approved: 0, denied: 0, all: rows.length };
    for (const r of rows) {
      const s = normalizeStatus(r.status);
      c[s as "new" | "approved" | "denied"] += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const s = normalizeStatus(r.status);
      if (activeTab !== "all" && s !== activeTab) return false;
      if (!q) return true;
      const hay = `${r.full_name} ${r.email} ${r.company ?? ""} ${r.reason ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, activeTab, query]);

  async function setStatus(id: string, nextStatus: "approved" | "denied") {
    setErrorMsg(null);
    setWorkingId(id);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;

    const { error } = await supabase
      .from("access_requests")
      .update({
        status: nextStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", id);

    setWorkingId(null);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setToast(nextStatus === "approved" ? "Approved" : "Denied");
    await load();
  }

  function copyInviteText(email: string) {
    const text =
      `Subject: Freshware Portal Access\n\n` +
      `You have been approved for access to the Freshware portal.\n\n` +
      `Login URL: https://freshware.freshtechsolutionz.com/login\n` +
      `Email: ${email}\n\n` +
      `If you need to set your password, click "Forgot password" on the login page.\n`;

    navigator.clipboard.writeText(text);
    setToast("Invite email copied");
  }

  const roleLower = (profile?.role ?? "").toLowerCase();
  const isAdmin = roleLower === "ceo" || roleLower === "admin";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-3xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-56 rounded bg-gray-200 animate-pulse" />
          <div className="mt-4 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
            <div className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
            <div className="h-20 rounded-2xl bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">Access Requests</div>
          <div className="mt-1 text-sm text-gray-600">
            Review invite-only requests and approve or deny access.
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
            href="/"
            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
          >
            Portal entry
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {toast && (
          <div className="mb-4 rounded-2xl border bg-white p-3 text-sm font-semibold text-gray-900 shadow-sm">
            {toast}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {!isAdmin ? (
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">Not authorized</div>
            <div className="mt-2 text-sm text-gray-600">
              You do not have permission to view access requests.
            </div>
          </div>
        ) : (
          <>
            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <TabButton active={activeTab === "new"} onClick={() => setActiveTab("new")} label={`New (${counts.new})`} />
                  <TabButton active={activeTab === "approved"} onClick={() => setActiveTab("approved")} label={`Approved (${counts.approved})`} />
                  <TabButton active={activeTab === "denied"} onClick={() => setActiveTab("denied")} label={`Denied (${counts.denied})`} />
                  <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label={`All (${counts.all})`} />
                </div>

                <div className="w-full lg:w-[360px]">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, email, company, reason"
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border bg-gray-50 p-6 text-sm text-gray-600">
                    No requests found for this view.
                  </div>
                ) : (
                  filtered.map((r) => (
                    <div key={r.id} className="rounded-3xl border bg-white p-5">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-gray-900">{r.full_name}</div>
                            <StatusPill status={normalizeStatus(r.status)} />
                          </div>

                          <div className="mt-1 text-sm text-gray-700 break-all">{r.email}</div>

                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">Requested:</span>{" "}
                            {formatDateTime(r.created_at)}
                            {r.company ? (
                              <>
                                {" "}
                                <span className="text-gray-400">•</span>{" "}
                                <span className="font-semibold text-gray-900">Company:</span> {r.company}
                              </>
                            ) : null}
                          </div>

                          {r.reason ? (
                            <div className="mt-3 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                              <div className="text-xs font-semibold text-gray-700">Reason</div>
                              <div className="mt-1">{r.reason}</div>
                            </div>
                          ) : null}

                          {normalizeStatus(r.status) !== "new" ? (
                            <div className="mt-3 text-xs text-gray-500">
                              Reviewed at {r.reviewed_at ? formatDateTime(r.reviewed_at) : "unknown"}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2 w-full md:w-[220px]">
                          {normalizeStatus(r.status) === "new" ? (
                            <>
                              <button
                                onClick={() => setStatus(r.id, "approved")}
                                disabled={workingId === r.id}
                                className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90 disabled:opacity-50"
                              >
                                {workingId === r.id ? "Working..." : "Approve"}
                              </button>
                              <button
                                onClick={() => setStatus(r.id, "denied")}
                                disabled={workingId === r.id}
                                className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                              >
                                {workingId === r.id ? "Working..." : "Deny"}
                              </button>
                            </>
                          ) : (
                            <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                              <div className="text-xs font-semibold text-gray-700">Next step</div>
                              <div className="mt-1">
                                {normalizeStatus(r.status) === "approved"
                                  ? "Create the Auth user and profile, then send the invite message."
                                  : "No further action required."}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => copyInviteText(r.email)}
                            className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                          >
                            Copy invite email
                          </button>

                          <a
                            href={`mailto:${r.email}?subject=${encodeURIComponent("Freshware Portal Access")}`}
                            className="text-center rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
                          >
                            Email requester
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Approval process</div>
              <div className="mt-2 text-sm text-gray-600">
                This page manages request status. To grant access, create the user in Supabase Auth and ensure a matching
                profile exists with the correct role and account_id.
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <ProcessCard title="1) Create Auth user" body="Supabase → Authentication → Users → Add user (email)." />
                <ProcessCard title="2) Create profile" body="Insert profiles row with role and account_id so RLS works." />
                <ProcessCard title="3) Send access info" body="Share the login URL and password reset instructions." />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      className={
        props.active
          ? "rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white"
          : "rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
      }
    >
      {props.label}
    </button>
  );
}

function StatusPill(props: { status: "new" | "approved" | "denied" }) {
  const label = props.status === "new" ? "New" : props.status === "approved" ? "Approved" : "Denied";
  const cls =
    props.status === "new"
      ? "bg-gray-50 text-gray-700 border-gray-200"
      : props.status === "approved"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function ProcessCard(props: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border bg-gray-50 p-5">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-2 text-sm text-gray-600">{props.body}</div>
    </div>
  );
}
