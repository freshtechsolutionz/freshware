"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;
};

type UserLite = {
  id: string;
  full_name: string | null;
};

type AccountLite = {
  id: string;
  name: string | null;
  industry: string | null;
};

type ContactLite = {
  id: string;
  name: string | null;
  email: string | null;
  account_id: string;
};

type Opportunity = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  name: string | null;
  service_line: string | null;
  stage: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  created_at: string;

  // ✅ added by server page
  last_touch_at?: string | null;
};

const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function money(n: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `$${Math.round(n || 0).toLocaleString()}`;
  }
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(now: Date, past: Date): number {
  const ms = now.getTime() - past.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

type OwnerScope = "all" | "me" | "unassigned";

export default function OpportunitiesClient({
  profile,
  users = [],
  initialAccounts,
  initialContacts,
  initialRows,
  lookupError,
  rowsError: serverRowsError,
}: {
  profile: Profile;
  users?: UserLite[];
  initialAccounts: AccountLite[];
  initialContacts: ContactLite[];
  initialRows: Opportunity[];
  lookupError: string | null;
  rowsError: string | null;
}) {
  const router = useRouter();

  // kept for compatibility (not used on this page yet)
  const _accounts = initialAccounts;
  const _contacts = initialContacts;

  const rows = initialRows;

  const [rowsError, setRowsError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [ownerScope, setOwnerScope] = useState<OwnerScope>("all");

  // ✅ Stuck deals threshold
  const [staleDays, setStaleDays] = useState<number>(14);

  // quick note per row (stuck panel)
  const [noteByOpp, setNoteByOpp] = useState<Record<string, string>>({});

  const role = profile?.role ?? "PENDING";
  const canUpdate = useMemo(() => ["CEO", "ADMIN", "SALES", "OPS"].includes(role), [role]);

  const usersById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of users) m[u.id] = u.full_name ?? "Unnamed";
    return m;
  }, [users]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  async function updateOpportunity(
    id: string,
    patch: Partial<Pick<Opportunity, "stage" | "amount" | "probability" | "close_date" | "owner_user_id">>
  ) {
    if (!canUpdate) {
      setRowsError("You do not have permission to update opportunities.");
      return;
    }

    setSavingId(id);
    setRowsError(null);

    const { error } = await supabase.from("opportunities").update(patch).eq("id", id);

    if (error) {
      setRowsError(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
    router.refresh();
  }

  async function logActivity(opportunityId: string, activity_type: "call" | "email" | "meeting" | "note", summary?: string) {
    if (!canUpdate) {
      setRowsError("You do not have permission to log activity.");
      return;
    }

    setSavingId(opportunityId);
    setRowsError(null);

    const payload = {
      opportunity_id: opportunityId,
      actor_user_id: profile.id,
      activity_type,
      summary: summary?.trim() ? summary.trim() : null,
      occurred_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("opportunity_activities").insert(payload);

    if (error) {
      setRowsError(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
    setNoteByOpp((prev) => ({ ...prev, [opportunityId]: "" }));
    router.refresh();
  }

  function passesOpenOnly(o: Opportunity) {
    const st = (o.stage ?? "").toLowerCase();
    if (!openOnly) return true;
    return st !== "won" && st !== "lost";
  }

  function passesOwner(o: Opportunity) {
    if (ownerScope === "all") return true;
    if (ownerScope === "me") return (o.owner_user_id ?? "") === profile.id;
    return !o.owner_user_id;
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((o) => {
      const st = (o.stage ?? "").toLowerCase();

      if (!passesOpenOnly(o)) return false;
      if (!passesOwner(o)) return false;

      if (stageFilter !== "all" && st !== stageFilter.toLowerCase()) return false;

      if (q) {
        const name = (o.name ?? "").toLowerCase();
        const id = (o.id ?? "").toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, stageFilter, openOnly, ownerScope, profile.id]);

  // ✅ KPIs (open pipeline)
  const kpis = useMemo(() => {
    let openDeals = 0;
    let openPipeline = 0;
    let openWeighted = 0;

    for (const o of filteredRows) {
      const st = (o.stage ?? "").toLowerCase();
      if (st === "won" || st === "lost") continue;

      const amt = toNumber(o.amount);
      const prob = clampPct(toNumber(o.probability));

      openDeals += 1;
      openPipeline += amt;
      openWeighted += amt * (prob / 100);
    }

    return { openDeals, openPipeline, openWeighted };
  }, [filteredRows]);

  // ✅ Stuck deals list (NOW uses last_touch_at from activities)
  const stuckDeals = useMemo(() => {
    const now = new Date();

    const calcDaysStale = (o: Opportunity) => {
      const last = safeDate(o.last_touch_at) ?? safeDate(o.created_at) ?? null;
      if (!last) return 0;
      return daysBetween(now, last);
    };

    const isOpen = (o: Opportunity) => {
      const st = (o.stage ?? "").toLowerCase();
      return st !== "won" && st !== "lost";
    };

    return filteredRows
      .filter((o) => isOpen(o))
      .map((o) => ({ o, daysStale: calcDaysStale(o) }))
      .filter((x) => x.daysStale >= staleDays)
      .sort((a, b) => b.daysStale - a.daysStale)
      .slice(0, 10);
  }, [filteredRows, staleDays]);

  return (
    <>
      {/* Header */}
      <div className="p-3 border rounded-md">
        <div>
          <b>User:</b> {profile?.full_name ?? "(no name)"}
        </div>
        <div>
          <b>Role:</b> {role}
        </div>
        <div>
          <b>Account:</b> {profile?.account_id ?? "(none)"}
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-2">
        <button className="underline" onClick={() => router.push("/dashboard")}>
          ← Dashboard
        </button>
        <button className="underline" onClick={() => router.push("/sales")}>
          Sales Pipeline
        </button>
        <button className="underline text-red-600" onClick={logout}>
          Log out
        </button>
      </div>

      {/* Errors */}
      {(lookupError || serverRowsError || rowsError) && (
        <div className="mt-2 p-3 border rounded-md">
          <b className="text-red-600">Error:</b> {rowsError ?? serverRowsError ?? lookupError}
        </div>
      )}

      {/* ✅ Stuck Deals */}
      <div className="mt-4 border rounded-md p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Stuck Deals</div>
            <div className="text-sm opacity-70">
              Open deals with no logged activity for <b>{staleDays}</b>+ days (from <code>opportunity_activities</code>)
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            Stale threshold
            <select
              value={staleDays}
              onChange={(e) => setStaleDays(Number(e.target.value))}
              className="border rounded-md p-2"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={21}>21 days</option>
              <option value={30}>30 days</option>
              <option value={45}>45 days</option>
              <option value={60}>60 days</option>
            </select>
          </label>
        </div>

        {stuckDeals.length === 0 ? (
          <div className="text-sm opacity-70">No stuck deals 🎉</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left border-b p-2">Deal</th>
                  <th className="text-left border-b p-2">Owner</th>
                  <th className="text-left border-b p-2">Stage</th>
                  <th className="text-left border-b p-2">Amount</th>
                  <th className="text-left border-b p-2">Days Stale</th>
                  <th className="text-left border-b p-2">Last Touch</th>
                  <th className="text-left border-b p-2">Log Activity</th>
                </tr>
              </thead>

              <tbody>
                {stuckDeals.map(({ o, daysStale }) => {
                  const ownerName = o.owner_user_id
                    ? o.owner_user_id === profile.id
                      ? "Me"
                      : usersById[o.owner_user_id] ?? o.owner_user_id
                    : "Unassigned";

                  const last = safeDate(o.last_touch_at) ?? safeDate(o.created_at);
                  const lastStr = last ? last.toLocaleDateString() : "(unknown)";

                  return (
                    <tr key={o.id}>
                      <td className="p-2 border-b">
                        <Link href={`/opportunities/${o.id}`} className="underline underline-offset-2 hover:opacity-80">
                          {o.name ?? "(no name)"}
                        </Link>
                        <div className="text-xs opacity-70">{o.id}</div>
                      </td>

                      <td className="p-2 border-b">{ownerName}</td>
                      <td className="p-2 border-b">{o.stage ?? "(none)"}</td>
                      <td className="p-2 border-b">{money(toNumber(o.amount))}</td>

                      <td className="p-2 border-b">
                        <span className="font-semibold">{daysStale}</span> days
                      </td>

                      <td className="p-2 border-b">{lastStr}</td>

                      <td className="p-2 border-b">
                        {canUpdate ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="underline"
                                disabled={savingId === o.id}
                                onClick={() => logActivity(o.id, "call")}
                              >
                                {savingId === o.id ? "Saving…" : "Call"}
                              </button>
                              <button className="underline" disabled={savingId === o.id} onClick={() => logActivity(o.id, "email")}>
                                Email
                              </button>
                              <button className="underline" disabled={savingId === o.id} onClick={() => logActivity(o.id, "meeting")}>
                                Meeting
                              </button>
                            </div>

                            <div className="flex gap-2">
                              <input
                                value={noteByOpp[o.id] ?? ""}
                                onChange={(e) => setNoteByOpp((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                placeholder="Quick note…"
                                className="border rounded-md p-1 flex-1"
                              />
                              <button
                                className="underline"
                                disabled={savingId === o.id}
                                onClick={() => logActivity(o.id, "note", noteByOpp[o.id] ?? "")}
                              >
                                Note
                              </button>
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or ID"
          className="border rounded-md p-2"
        />

        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="border rounded-md p-2">
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={ownerScope} onChange={(e) => setOwnerScope(e.target.value as OwnerScope)} className="border rounded-md p-2">
          <option value="all">All owners</option>
          <option value="me">Mine</option>
          <option value="unassigned">Unassigned</option>
        </select>

        <button onClick={() => setOpenOnly((v) => !v)} className="border rounded-md">
          Open Only: {openOnly ? "ON" : "OFF"}
        </button>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="p-3 border rounded-md">
          <div className="text-xs opacity-70">Open Deals</div>
          <div className="text-lg font-semibold">{kpis.openDeals}</div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs opacity-70">Open Pipeline</div>
          <div className="text-lg font-semibold">{money(kpis.openPipeline)}</div>
        </div>
        <div className="p-3 border rounded-md">
          <div className="text-xs opacity-70">Weighted</div>
          <div className="text-lg font-semibold">{money(kpis.openWeighted)}</div>
        </div>
      </div>

      {/* LIST */}
      <div className="mt-5">
        <h3 className="font-semibold mb-2">Opportunities</h3>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left border-b p-2">Name</th>
              <th className="text-left border-b p-2">Owner</th>
              <th className="text-left border-b p-2">Stage</th>
              <th className="text-left border-b p-2">Amount</th>
              <th className="text-left border-b p-2">Prob%</th>
              <th className="text-left border-b p-2">Close</th>
              <th className="text-left border-b p-2">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((o) => {
              const ownerName = o.owner_user_id
                ? o.owner_user_id === profile.id
                  ? "Me"
                  : usersById[o.owner_user_id] ?? o.owner_user_id
                : "Unassigned";

              return (
                <tr key={o.id}>
                  <td className="p-2 border-b">
                    <div className="font-semibold">
                      <Link href={`/opportunities/${o.id}`} className="underline underline-offset-2 hover:opacity-80">
                        {o.name ?? "(no name)"}
                      </Link>
                    </div>
                    <div className="text-xs opacity-70">{o.id}</div>
                  </td>

                  <td className="p-2 border-b">{ownerName}</td>

                  <td className="p-2 border-b">
                    {canUpdate ? (
                      <select
                        value={o.stage ?? "new"}
                        onChange={(e) => updateOpportunity(o.id, { stage: e.target.value })}
                        disabled={savingId === o.id}
                        className="border rounded-md p-1"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      o.stage ?? "(none)"
                    )}
                  </td>

                  <td className="p-2 border-b">{money(toNumber(o.amount))}</td>
                  <td className="p-2 border-b">{pct(clampPct(toNumber(o.probability)))}</td>
                  <td className="p-2 border-b">{o.close_date ?? "(none)"}</td>
                  <td className="p-2 border-b">{savingId === o.id ? "Saving…" : "—"}</td>
                </tr>
              );
            })}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-2 opacity-70">
                  No opportunities match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
