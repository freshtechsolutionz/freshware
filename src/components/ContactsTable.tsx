"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  account_id: string | null;
  created_at: string | null;
};

type AccountLite = { id: string; name: string | null };

type Props = {
  role: string;
  contacts: Contact[];
  accountsMap: Record<string, AccountLite>;
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function ContactsTable({ role, contacts, accountsMap }: Props) {
  const [search, setSearch] = useState("");

  const canCreate = ["CEO", "ADMIN", "SALES"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contacts || []).filter((c) => {
      if (!q) return true;
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const accountName = c.account_id
        ? (accountsMap[c.account_id]?.name || "").toLowerCase()
        : "";
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        accountName.includes(q)
      );
    });
  }, [contacts, accountsMap, search]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name, email, phone, or account…"
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
              href="/dashboard/contacts/new"
              className="rounded-lg border bg-background px-3 py-2 text-sm font-medium"
            >
              + New Contact
            </Link>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{rows.length}</span> of{" "}
          <span className="font-medium">{contacts.length}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/30">
                <Th>Contact</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Account</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((c) => {
                const accountName = c.account_id
                  ? accountsMap[c.account_id]?.name || "—"
                  : "—";

                return (
                  <tr key={c.id} className="border-t">
                    <Td>
                      <div className="font-semibold">{c.name || "(No name)"}</div>
                      <div className="text-xs text-muted-foreground">{c.id}</div>
                    </Td>
                    <Td>{c.email || "—"}</Td>
                    <Td>{c.phone || "—"}</Td>
                    <Td>{accountName}</Td>
                    <Td>{fmtDate(c.created_at)}</Td>
                    <Td>
                      <Link href={`/dashboard/contacts/${c.id}`} className="underline">
                        View / Edit
                      </Link>
                    </Td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <Td colSpan={6}>
                    <div className="p-4">
                      <div className="font-semibold">No contacts found</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Try clearing search or add a new contact.
                      </div>
                      {canCreate && (
                        <div className="mt-3">
                          <Link href="/dashboard/contacts/new" className="underline">
                            + Create contact
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
