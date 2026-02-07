"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  SALES_STAGES,
  SERVICE_LINES,
  formatServiceLine,
} from "@/lib/salesConfig";

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
        ? (accountsMap[o.account_id]?.name || "")
        : "";
      const contactName = o.contact_id
        ? (contactsMap[o.contact_id]?.name || "")
        : "";

      const searchOk =
        q.length === 0
          ? true
          : name.includes(q) ||
            accountName.toLowerCase().includes(q) ||
            contactName.toLowerCase().includes(q);

      return stageOk && serviceOk && searchOk;
    });
  }, [opportunities, search, stageFilter, serviceFilter, accountsMap, contactsMap]);

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by opp/account/contact…"
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              minWidth: 260,
            }}
          />

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
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
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
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
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Showing <b>{rows.length}</b> of <b>{opportunities.length}</b>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <Th>Opportunity</Th>
                <Th>Account</Th>
                <Th>Stage</Th>
                <Th>Service</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Prob%</Th>
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
                  <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                    <Td>
                      <div style={{ fontWeight: 700 }}>{o.name || "(No name)"}</div>
                      <div style={{ fontSize: 12, opacity: 0.65 }}>{o.id}</div>
                    </Td>
                    <Td>{accountName}</Td>
                    <Td>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: "#fff",
                          fontSize: 12,
                        }}
                      >
                        {safeStage(o.stage)}
                      </span>
                    </Td>
                    <Td>{formatServiceLine(o.service_line || "") || "—"}</Td>
                    <Td align="right">{fmtMoney(o.amount)}</Td>
                    <Td align="right">{o.probability ?? 0}</Td>
                    <Td>{fmtDate(o.close_date)}</Td>
                    <Td>{fmtDate(o.created_at)}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link href={`/dashboard/opportunities/${o.id}`}>View / Edit</Link>
                      </div>
                    </Td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <Td colSpan={9}>
                    <div style={{ padding: 18 }}>
                      <div style={{ fontWeight: 800 }}>No opportunities found</div>
                      <div style={{ opacity: 0.7, marginTop: 6 }}>
                        Try clearing filters or create a new opportunity.
                      </div>
                      {canCreate && (
                        <div style={{ marginTop: 10 }}>
                          <Link href="/dashboard/opportunities/new">+ New Opportunity</Link>
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

      {canCreate && (
        <div style={{ marginTop: 12 }}>
          <Link href="/dashboard/opportunities/new">+ Create opportunity</Link>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: any;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        textAlign: align || "left",
        padding: 12,
        borderBottom: "1px solid #eee",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        opacity: 0.7,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  colSpan,
}: {
  children: any;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align || "left",
        padding: 12,
        verticalAlign: "top",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
