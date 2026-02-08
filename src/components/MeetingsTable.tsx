"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TableToolbar from "@/components/dashboard/TableToolbar";
import EmptyState from "@/components/dashboard/EmptyState";
import { DataTableShell, Th, Td } from "@/components/dashboard/DataTableShell";

type Meeting = {
  id: string;
  external_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  scheduled_at: string | null;
  status: string | null;
  source: string | null;
  created_at: string | null;
  account_id: string | null;
  created_by: string | null;
};

type Props = {
  role: string;
  meetings: Meeting[];
};

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

export default function MeetingsTable({ role, meetings }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const canCreate = ["CEO", "ADMIN", "SALES"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (meetings || []).filter((m) => {
      const statusOk =
        statusFilter === "all" ? true : (m.status || "") === statusFilter;

      const contactName = (m.contact_name || "").toLowerCase();
      const contactEmail = (m.contact_email || "").toLowerCase();
      const source = (m.source || "").toLowerCase();

      const searchOk =
        !q || contactName.includes(q) || contactEmail.includes(q) || source.includes(q);

      return statusOk && searchOk;
    });
  }, [meetings, search, statusFilter]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    (meetings || []).forEach((m) => {
      if (m.status) set.add(m.status);
    });
    return Array.from(set).sort();
  }, [meetings]);

  return (
    <div>
      <TableToolbar
        left={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by contact name, email, or source…"
              className="min-w-[260px] rounded-lg border px-3 py-2 text-sm"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              type="button"
            >
              Reset
            </button>

            {canCreate && (
              <Link
                href="/dashboard/meetings/new"
                className="rounded-lg border bg-background px-3 py-2 text-sm font-medium"
              >
                + New Meeting
              </Link>
            )}
          </>
        }
        right={
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{rows.length}</span> of{" "}
            <span className="font-medium">{meetings.length}</span>
          </div>
        }
      />

      <DataTableShell>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30">
              <Th>Scheduled</Th>
              <Th>Contact</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t">
                <Td>{fmtDateTime(m.scheduled_at)}</Td>
                <Td>{m.contact_name || "—"}</Td>
                <Td>{m.contact_email || "—"}</Td>
                <Td>{m.status || "—"}</Td>
                <Td>{m.source || "—"}</Td>
                <Td>
                  <Link href={`/dashboard/meetings/${m.id}`} className="underline">
                    View / Edit
                  </Link>
                </Td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <Td colSpan={6}>
                  <EmptyState
                    title="No meetings found"
                    description="Try clearing filters or create a new meeting."
                    actionHref={canCreate ? "/dashboard/meetings/new" : undefined}
                    actionLabel={canCreate ? "+ Create meeting" : undefined}
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
