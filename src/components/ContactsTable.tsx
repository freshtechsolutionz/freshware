"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  account_id: string | null;
  created_at: string | null;

  source?: string | null;
  imported_at?: string | null;
  last_seen_at?: string | null;
  owner_profile_id?: string | null;
};

type AccountLite = { id: string; name: string | null };
type OwnerLite = { id: string; full_name: string | null };

type Props = {
  role: string;
  contacts: Contact[];
  accountsMap: Record<string, AccountLite>;
  ownersMap: Record<string, OwnerLite>;
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return "—"; }
}

export default function ContactsTable({ role, contacts, accountsMap, ownersMap }: Props) {
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const canCreate = ["CEO", "ADMIN", "SALES"].includes((role || "").toUpperCase());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contacts || []).filter((c) => {
      if (!q) return true;

      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const accountName = c.account_id ? (accountsMap[c.account_id]?.name || "").toLowerCase() : "";
      const ownerName = c.owner_profile_id ? (ownersMap[c.owner_profile_id]?.full_name || "").toLowerCase() : "";
      const src = (c.source || "").toLowerCase();

      return name.includes(q) || email.includes(q) || phone.includes(q) || accountName.includes(q) || ownerName.includes(q) || src.includes(q);
    });
  }, [contacts, accountsMap, ownersMap, search]);

  async function convertToLead(contactId: string) {
    setError(null);
    setToast(null);
    setWorkingId(contactId);

    try {
      const res = await fetch(`/api/contacts/${contactId}/convert-to-lead`, { method: "POST" });
      const text = await res.text();
      const json = JSON.parse(text);

      if (!res.ok) {
        setError(json?.error || "Convert failed");
        setWorkingId(null);
        return;
      }

      setToast("Converted to lead");
      if (json.opportunity_id) {
        window.location.href = `/dashboard/opportunities/${json.opportunity_id}`;
        return;
      }
    } catch (e: any) {
      setError(e?.message || "Convert failed");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div>
      {toast ? <div className="mb-3 rounded-lg border bg-background px-3 py-2 text-sm">{toast}</div> : null}
      {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <TableToolbar
        left={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name, email, phone, owner, source…"
              className="min-w-[260px] rounded-lg border px-3 py-2 text-sm"
            />

            <button onClick={() => setSearch("")} className="rounded-lg border bg-background px-3 py-2 text-sm" type="button">
              Reset
            </button>

            {canCreate && (
              <Link href="/dashboard/contacts/new" className="rounded-lg border bg-background px-3 py-2 text-sm font-medium">
                + New Contact
              </Link>
            )}
          </>
        }
        right={
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{rows.length}</span> of <span className="font-medium">{contacts.length}</span>
          </div>
        }
      />

      <DataTableShell>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30">
              <Th>Contact</Th>
              <Th>Owner</Th>
              <Th>Source</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((c) => {
              const ownerName = c.owner_profile_id ? ownersMap[c.owner_profile_id]?.full_name || "—" : "—";
              const source = c.source || "manual";

              return (
                <tr key={c.id} className="border-t">
                  <Td>
                    <div className="font-semibold">{c.name || "(No name)"}</div>
                    <div className="text-xs text-muted-foreground">{c.id}</div>
                  </Td>

                  <Td>{ownerName}</Td>

                  <Td>
                    <div className="text-sm font-semibold">{source}</div>
                    <div className="text-xs text-muted-foreground">
                      Imported: {fmtDate(c.imported_at)} • Last seen: {fmtDate(c.last_seen_at)}
                    </div>
                  </Td>

                  <Td>{c.email || "—"}</Td>
                  <Td>{c.phone || "—"}</Td>
                  <Td>{fmtDate(c.created_at)}</Td>

                  <Td>
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/dashboard/contacts/${c.id}`} className="underline">
                        View / Edit
                      </Link>

                      <button
                        type="button"
                        className="underline"
                        disabled={workingId === c.id}
                        onClick={() => convertToLead(c.id)}
                      >
                        {workingId === c.id ? "Converting…" : "Convert → Lead"}
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <Td colSpan={7}>
                  <EmptyState
                    title="No contacts found"
                    description="Try clearing search, or add/import a contact."
                    actionHref={canCreate ? "/dashboard/contacts/new" : undefined}
                    actionLabel={canCreate ? "+ Create contact" : undefined}
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
