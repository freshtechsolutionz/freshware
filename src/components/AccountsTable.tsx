"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";

type Company = {
  id: string;
  name: string | null;
  legal_name: string | null;
  website: string | null;
  industry: string | null;
  customer_segment: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  created_at: string | null;
};

type Props = {
  role: string;
  accounts: Company[];
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

function pretty(v: string | null | undefined) {
  if (!v) return "—";
  return v.replaceAll("_", " ");
}

export default function AccountsTable({ role, accounts }: Props) {
  const [search, setSearch] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [priority, setPriority] = useState("");

  const canCreate = ["CEO", "ADMIN", "SALES", "OPS", "STAFF"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accounts || []).filter((a) => {
      if (lifecycle && (a.lifecycle_stage || "") !== lifecycle) return false;
      if (priority && (a.priority_level || "") !== priority) return false;

      if (!q) return true;

      const hay = [
        a.name || "",
        a.legal_name || "",
        a.website || "",
        a.industry || "",
        a.customer_segment || "",
        a.lifecycle_stage || "",
        a.priority_level || "",
        a.city || "",
        a.state || "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [accounts, search, lifecycle, priority]);

  const lifecycleOptions = Array.from(
    new Set((accounts || []).map((a) => a.lifecycle_stage).filter(Boolean))
  ) as string[];

  const priorityOptions = Array.from(
    new Set((accounts || []).map((a) => a.priority_level).filter(Boolean))
  ) as string[];

  return (
    <div>
      <TableToolbar
        left={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, website, industry, segment…"
              className="min-w-[260px] rounded-lg border px-3 py-2 text-sm"
            />

            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All lifecycle stages</option>
              {lifecycleOptions.map((x) => (
                <option key={x} value={x}>
                  {pretty(x)}
                </option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All priority levels</option>
              {priorityOptions.map((x) => (
                <option key={x} value={x}>
                  {pretty(x)}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch("");
                setLifecycle("");
                setPriority("");
              }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              type="button"
            >
              Reset
            </button>

            {canCreate && (
              <Link
                href="/dashboard/accounts/new"
                className="rounded-lg border bg-background px-3 py-2 text-sm font-medium"
              >
                + New Company
              </Link>
            )}
          </>
        }
        right={
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{rows.length}</span> of{" "}
            <span className="font-medium">{accounts.length}</span>
          </div>
        }
      />

      <DataTableShell>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30">
              <Th>Company</Th>
              <Th>Industry</Th>
              <Th>Segment</Th>
              <Th>Lifecycle</Th>
              <Th>Priority</Th>
              <Th>Location</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t">
                <Td>
                  <div className="font-semibold">{a.name || "(No name)"}</div>
                  <div className="text-xs text-muted-foreground">{a.website || a.legal_name || a.id}</div>
                </Td>
                <Td>{a.industry || "—"}</Td>
                <Td>{pretty(a.customer_segment)}</Td>
                <Td>{pretty(a.lifecycle_stage)}</Td>
                <Td>{pretty(a.priority_level)}</Td>
                <Td>{[a.city, a.state].filter(Boolean).join(", ") || "—"}</Td>
                <Td>{fmtDate(a.created_at)}</Td>
                <Td>
                  <Link href={`/dashboard/accounts/${a.id}`} className="underline">
                    Open Profile
                  </Link>
                </Td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <Td colSpan={8}>
                  <EmptyState
                    title="No company profiles found"
                    description="Try clearing filters or create a new company profile."
                    actionHref={canCreate ? "/dashboard/accounts/new" : undefined}
                    actionLabel={canCreate ? "+ Create company" : undefined}
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