"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
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
        </div>

        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{rows.length}</span> of{" "}
          <span className="font-medium">{accounts.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="overflow-x-auto">
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
                    <Link
                      href={`/dashboard/accounts/${a.id}`}
                      className="underline"
                    >
                      View / Edit
                    </Link>
                  </Td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <Td colSpan={4}>
                    <div className="p-4">
                      <div className="font-semibold">No accounts found</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Try clearing search or add a new account.
                      </div>
                      {canCreate && (
                        <div className="mt-3">
                          <Link
                            href="/dashboard/accounts/new"
                            className="underline"
                          >
                            + Create account
                          </Link>
                        </div>
                      )}
                    </div>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className="whitespace-nowrap px-3 py-3 align-top">
      {children}
    </td>
  );
}
