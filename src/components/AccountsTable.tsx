"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";

type Account = {
  id: string;
  name: string | null;
  industry: string | null;
  created_at: string | null;
};

type Props = {
  role: string;
  accounts: Account[];
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function AccountsTable({ role, accounts }: Props) {
  const [search, setSearch] = useState("");

  const canCreate = ["CEO", "ADMIN", "SALES"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accounts || []).filter((a) => {
      if (!q) return true;
      const name = (a.name || "").toLowerCase();
      const industry = (a.industry || "").toLowerCase();
      return name.includes(q) || industry.includes(q);
    });
  }, [accounts, search]);

  return (
    <div>
      <TableToolbar
        left={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts by name or industry…"
              className="min-w-[260px] rounded-lg border px-3 py-2 text-sm"
            />

            <button
              onClick={() => setSearch("")}
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
                + New Account
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
              <Th>Account</Th>
              <Th>Industry</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t">
                <Td>
                  <div className="font-semibold">{a.name || "(No name)"}</div>
                  <div className="text-xs text-muted-foreground">{a.id}</div>
                </Td>
                <Td>{a.industry || "—"}</Td>
                <Td>{fmtDate(a.created_at)}</Td>
                <Td>
                  <Link href={`/dashboard/accounts/${a.id}`} className="underline">
                    View / Edit
                  </Link>
                </Td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <Td colSpan={4}>
                  <EmptyState
                    title="No accounts found"
                    description="Try clearing search or add a new account."
                    actionHref={canCreate ? "/dashboard/accounts/new" : undefined}
                    actionLabel={canCreate ? "+ Create account" : undefined}
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
