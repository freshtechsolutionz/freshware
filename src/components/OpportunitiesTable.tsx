"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";
import { SALES_STAGES, SERVICE_LINES, formatServiceLine } from "@/lib/salesConfig";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  probability: number | null;
  close_date: string | null;
  account_id: string | null;
  contact_id: string | null;
  owner_user_id: string | null;
  last_activity_at: string | null;
  created_at: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

type Account = { id: string; name: string | null };
type Contact = { id: string; name: string | null; email: string | null };

type Props = {
  role: string;
  opportunities: Opportunity[];
  accountsMap: Record<string, Account>;
  contactsMap: Record<string, Contact>;
};

function safeStage(s: string | null | undefined) {
  return (s || "new").toString();
}

function fmtMoney(n: number | null | undefined) {
  return `$${Number(n || 0).toLocaleString()}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "(none)";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "(none)";
  }
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function OpportunitiesTable({ role, opportunities, accountsMap, contactsMap }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const canCreate = ["CEO", "ADMIN", "SALES"].includes(role);
  const canManage = ["CEO", "ADMIN"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (opportunities || []).filter((o) => {
      const stageOk = stageFilter === "all" ? true : safeStage(o.stage) === stageFilter;

      const serviceOk =
        serviceFilter === "all" ? true : (o.service_line || "") === serviceFilter;

      const name = (o.name || "").toLowerCase();
      const accountName = o.account_id ? (accountsMap[o.account_id]?.name || "").toLowerCase() : "";
      const contactName = o.contact_id ? (contactsMap[o.contact_id]?.name || "").toLowerCase() : "";

      const searchOk = !q || name.includes(q) || accountName.includes(q) || contactName.includes(q);

      return stageOk && serviceOk && searchOk;
    });
  }, [opportunities, search, stageFilter, serviceFilter, accountsMap, contactsMap]);

  async function patchOpportunity(id: string, patch: any) {
    setSavingId(id);
    setRowError(null);

    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Update failed");

      router.refresh();
    } catch (e: any) {
      setRowError(e?.message || "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteOpportunity(id: string, name: string | null) {
    if (!canManage) return;

    const ok = window.confirm(`Delete opportunity "${name || "(No name)"}"? This will archive it.`);
    if (!ok) return;

    setSavingId(id);
    setRowError(null);

    try {
      const res = await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete failed");

      router.refresh();
    } catch (e: any) {
      setRowError(e?.message || "Delete failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <TableToolbar
        left={
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by opp, account, contact"
              className="w-full sm:w-[320px] rounded-lg border px-3 py-2 text-sm"
            />

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full sm:w-auto rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">All stages</option>
              {SALES_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full sm:w-auto rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">All service lines</option>
              {SERVICE_LINES.map((s) => (
                <option key={s} value={s}>
                  {formatServiceLine(s)}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch("");
                setStageFilter("all");
                setServiceFilter("all");
              }}
              className="w-full sm:w-auto rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted/30 transition"
              type="button"
            >
              Reset
            </button>

            {canCreate && (
              <Link
                href="/dashboard/opportunities/new"
                className="w-full sm:w-auto rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/30 transition"
              >
                + New Opportunity
              </Link>
            )}
          </div>
        }
        right={
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{rows.length}</span> of{" "}
            <span className="font-medium">{opportunities.length}</span>
          </div>
        }
      />

      {rowError && (
        <div className="rounded-xl border bg-background p-3 text-sm">
          <b className="text-red-600">Error:</b> {rowError}
        </div>
      )}

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((o) => {
          const accountName = o.account_id ? accountsMap[o.account_id]?.name || "(none)" : "(none)";
          const stage = safeStage(o.stage);

          return (
            <div
              key={o.id}
              className={cx(
                "rounded-2xl border bg-background p-4 shadow-sm",
                "transition hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{o.name || "(No name)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{accountName}</div>
                </div>

                <Link href={`/dashboard/opportunities/${o.id}`} className="text-sm underline">
                  View
                </Link>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Stage</div>
                  <div className="mt-1">
                    <select
                      value={stage}
                      onChange={(e) => patchOpportunity(o.id, { stage: e.target.value })}
                      disabled={savingId === o.id}
                      className="w-full rounded-lg border px-2 py-2 text-sm"
                    >
                      {SALES_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div className="mt-1 font-semibold">{fmtMoney(o.amount)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Service</div>
                  <div className="mt-1">{formatServiceLine(o.service_line || "") || "(none)"}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Close</div>
                  <div className="mt-1">{fmtDate(o.close_date)}</div>
                </div>
              </div>

              {canManage && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={savingId === o.id}
                    onClick={() => deleteOpportunity(o.id, o.name)}
                    className="rounded-lg border border-red-200 bg-background px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition"
                  >
                    {savingId === o.id ? "Working..." : "Delete"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-2xl border bg-background p-4">
            <EmptyState
              title="No opportunities found"
              description="Try clearing filters or create a new opportunity."
              actionHref={canCreate ? "/dashboard/opportunities/new" : undefined}
              actionLabel={canCreate ? "+ Create opportunity" : undefined}
            />
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTableShell>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/30">
                <Th>Opportunity</Th>
                <Th>Account</Th>
                <Th>Stage</Th>
                <Th>Service</Th>
                <Th>Amount</Th>
                <Th>Prob%</Th>
                <Th>Close</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((o) => {
                const accountName = o.account_id ? accountsMap[o.account_id]?.name || "(none)" : "(none)";
                const stage = safeStage(o.stage);

                return (
                  <tr key={o.id} className="border-t hover:bg-muted/20 transition">
                    <Td>
                      <div className="font-semibold">{o.name || "(No name)"}</div>
                      <div className="text-xs text-muted-foreground">{o.id}</div>
                    </Td>

                    <Td>{accountName}</Td>

                    <Td>
                      <select
                        value={stage}
                        onChange={(e) => patchOpportunity(o.id, { stage: e.target.value })}
                        disabled={savingId === o.id}
                        className="rounded-lg border px-2 py-1 text-sm bg-background"
                      >
                        {SALES_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Td>

                    <Td>{formatServiceLine(o.service_line || "") || "(none)"}</Td>
                    <Td>{fmtMoney(o.amount)}</Td>
                    <Td>{o.probability ?? 0}</Td>
                    <Td>{fmtDate(o.close_date)}</Td>
                    <Td>{fmtDate(o.created_at)}</Td>

                    <Td>
                      <div className="flex items-center gap-3">
                        <Link href={`/dashboard/opportunities/${o.id}`} className="underline">
                          View / Edit
                        </Link>

                        {canManage && (
                          <button
                            type="button"
                            disabled={savingId === o.id}
                            onClick={() => deleteOpportunity(o.id, o.name)}
                            className="text-red-700 underline underline-offset-2 hover:opacity-80"
                          >
                            {savingId === o.id ? "Working..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <Td colSpan={9}>
                    <EmptyState
                      title="No opportunities found"
                      description="Try clearing filters or create a new opportunity."
                      actionHref={canCreate ? "/dashboard/opportunities/new" : undefined}
                      actionLabel={canCreate ? "+ Create opportunity" : undefined}
                    />
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </DataTableShell>
      </div>
    </div>
  );
}
