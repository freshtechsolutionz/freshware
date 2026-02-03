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
  last_activity_at: string | null;
  created_at: string;
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

  // ✅ These MUST exist to match page.tsx
  initialAccounts: AccountLite[];
  initialContacts: ContactLite[];

  initialRows: Opportunity[];
  lookupError: string | null;
  rowsError: string | null;
}) {
  const router = useRouter();

  // kept so we don’t “lose” anything; not used yet on this page
  const _accounts = initialAccounts;
  const _contacts = initialContacts;

  const rows = initialRows;

  const [rowsError, setRowsError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [ownerScope, setOwnerScope] = useState<OwnerScope>("all");

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
    patch: Partial<
      Pick<
        Opportunity,
        "name" | "service_line" | "stage" | "amount" | "probability" | "close_date" | "owner_user_id"
      >
    >
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

  return (
    <>
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

      {(lookupError || serverRowsError || rowsError) && (
        <div className="mt-2 p-3 border rounded-md">
          <b className="text-red-600">Error:</b> {rowsError ?? serverRowsError ?? lookupError}
        </div>
      )}

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

                  <td className="p-2 border-b">
                    {canUpdate ? (
                      <select
                        value={o.owner_user_id ?? ""}
                        onChange={(e) => updateOpportunity(o.id, { owner_user_id: e.target.value || null })}
                        disabled={savingId === o.id}
                        className="border rounded-md p-1"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.id === profile.id ? "Me" : u.full_name ?? "Unnamed"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{ownerName}</span>
                    )}
                  </td>

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
