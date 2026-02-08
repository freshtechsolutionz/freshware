"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function OpportunitiesTable({
  role,
  opportunities,
  accountsMap,
  contactsMap,
}: Props) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const canCreate = ["CEO", "ADMIN", "SALES"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (opportunities || []).filter((o) => {
      const stageOk =
        stageFilter === "all" ? true : safeStage(o.stage) === stageFilter;

      const serviceOk =
        serviceFilter === "all"
          ? true
          : (o.service_line || "") === serviceFilter;

      const name = (o.name || "").toLowerCase();
      const accountName = o.account_id
        ? (accountsMap[o.account_id]?.name || "").toLowerCase()
        : "";
      const contactName = o.contact_id
        ? (contactsMap[o.contact_id]?.name || "").toLowerCase()
        : "";

      const searchOk =
        !q || name.includes(q) || accountName.includes(q) || contactName.includes(q);

      return stageOk && serviceOk && searchOk;
    });
  }, [opportunities, search, stageFilter, serviceFilter, accountsMap, contactsMap]);

  return (
    <div>
      <TableToolbar
        left={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by opp/account/contact…"
              className="min-w-[260px] rounded-lg border px-3 py-2 text-sm"
            />

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
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
              className="rounded-lg border px-3 py-2 text-sm"
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
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              type="button"
            >
              Reset
            </button>

            {canCreate && (
              <Link
                href="/dashboard/opportunities/new"
                className="rounded-lg border bg-background px-3 py-2 text-sm font-medium"
              >
                + New Opportunity
              </Link>
            )}
          </>
        }
        right={
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{rows.length}</span> of{" "}
            <span className="font-medium">{opportunities.length}</span>
          </div>
        }
      />

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
              const accountName = o.account_id
                ? accountsMap[o.account_id]?.name || "—"
                : "—";

              return (
                <tr key={o.id} className="border-t">
                  <Td>
                    <div className="font-semibold">{o.name || "(No name)"}</div>
                    <div className="text-xs text-muted-foreground">{o.id}</div>
                  </Td>

                  <Td>{accountName}</Td>

                  <Td>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      {safeStage(o.stage)}
                    </span>
                  </Td>

                  <Td>{formatServiceLine(o.service_line || "") || "—"}</Td>

                  <Td>{fmtMoney(o.amount)}</Td>

                  <Td>{o.probability ?? 0}</Td>

                  <Td>{fmtDate(o.close_date)}</Td>

                  <Td>{fmtDate(o.created_at)}</Td>

                  <Td>
                    <Link
                      href={`/dashboard/opportunities/${o.id}`}
                      className="underline"
                    >
                      View / Edit
                    </Link>
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
  );
}
