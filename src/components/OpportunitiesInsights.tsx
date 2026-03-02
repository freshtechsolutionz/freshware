"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import OpportunitiesTable from "@/components/OpportunitiesTable";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  created_at: string | null;
  account_id: string | null;
  contact_id: string | null;
};

type Account = { id: string; name: string | null };
type Contact = { id: string; name: string | null; email: string | null };

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function uniq(arr: (string | null | undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[]));
}

function toggle(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function OpportunitiesInsights({
  role,
  opportunities,
  accountsMap,
  contactsMap,
}: {
  role: string;
  opportunities: Opportunity[];
  accountsMap: Record<string, Account>;
  contactsMap: Record<string, Contact>;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  // multi filters
  const [stages, setStages] = useState<string[]>([]);
  const [serviceLines, setServiceLines] = useState<string[]>([]);

  const stageOptions = useMemo(() => uniq(opportunities.map((o) => o.stage)), [opportunities]);
  const serviceLineOptions = useMemo(() => uniq(opportunities.map((o) => o.service_line)), [opportunities]);

  const filtered = useMemo(() => {
    let out = [...(opportunities || [])];

    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((o) => {
        const accountName = o.account_id ? (accountsMap[o.account_id]?.name || "") : "";
        const contactName = o.contact_id ? (contactsMap[o.contact_id]?.name || "") : "";
        const contactEmail = o.contact_id ? (contactsMap[o.contact_id]?.email || "") : "";

        const hay = [
          o.name || "",
          o.stage || "",
          o.service_line || "",
          accountName,
          contactName,
          contactEmail,
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(needle);
      });
    }

    if (stages.length) {
      out = out.filter((o) => o.stage && stages.includes(o.stage));
    }

    if (serviceLines.length) {
      out = out.filter((o) => o.service_line && serviceLines.includes(o.service_line));
    }

    out.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sort === "newest" ? db - da : da - db;
    });

    return out;
  }, [opportunities, q, stages, serviceLines, sort, accountsMap, contactsMap]);

  const total = useMemo(() => filtered.reduce((s, o) => s + Number(o.amount || 0), 0), [filtered]);

  const byStage = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const o of filtered) {
      const k = o.stage || "unknown";
      const amt = Number(o.amount || 0);
      const cur = map.get(k) || { name: k, value: 0, count: 0 };
      cur.value += amt;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byServiceLine = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const o of filtered) {
      const k = o.service_line || "unspecified";
      const amt = Number(o.amount || 0);
      const cur = map.get(k) || { name: k, value: 0, count: 0 };
      cur.value += amt;
      cur.count += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{filtered.length}</span> opportunities • Total{" "}
          <span className="font-semibold text-gray-900">{money(total)}</span>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            className="rounded-xl border px-3 py-2 text-sm md:w-80"
            placeholder="Search opportunities…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select className="rounded-xl border px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="newest">Newest → Oldest</option>
            <option value="oldest">Oldest → Newest</option>
          </select>

          <Link href="/dashboard/opportunities/new" className="rounded-xl border bg-black px-4 py-2 text-center text-sm font-semibold text-white">
            + New Opportunity
          </Link>
        </div>
      </div>

      {/* Multi filters */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-3">
          <div className="text-sm font-semibold">Stages (multi-select)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {stageOptions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStages((cur) => toggle(cur, s))}
                className={[
                  "rounded-full border px-3 py-1 text-sm",
                  stages.includes(s) ? "bg-black text-white" : "bg-white",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
            {stages.length ? (
              <button type="button" className="rounded-full border px-3 py-1 text-sm text-gray-700" onClick={() => setStages([])}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-3">
          <div className="text-sm font-semibold">Project Type (service_line) (multi-select)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {serviceLineOptions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setServiceLines((cur) => toggle(cur, s))}
                className={[
                  "rounded-full border px-3 py-1 text-sm",
                  serviceLines.includes(s) ? "bg-black text-white" : "bg-white",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
            {serviceLines.length ? (
              <button type="button" className="rounded-full border px-3 py-1 text-sm text-gray-700" onClick={() => setServiceLines([])}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold">Opportunities by Stage (Total $)</div>
          <div className="text-xs text-gray-600">Tap a slice to toggle that stage filter.</div>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byStage}
                  dataKey="value"
                  nameKey="name"
                  onClick={(d: any) => d?.name && setStages((cur) => toggle(cur, d.name))}
                >
                  {byStage.map((_, idx) => (
                    <Cell key={idx} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => money(Number(v || 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold">Opportunities by Project Type (service_line) (Total $)</div>
          <div className="text-xs text-gray-600">Tap a slice to toggle that type filter.</div>
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byServiceLine}
                  dataKey="value"
                  nameKey="name"
                  onClick={(d: any) => d?.name && setServiceLines((cur) => toggle(cur, d.name))}
                >
                  {byServiceLine.map((_, idx) => (
                    <Cell key={idx} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => money(Number(v || 0))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Existing table (kept) */}
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <OpportunitiesTable role={role} opportunities={filtered as any} accountsMap={accountsMap} contactsMap={contactsMap} />
      </div>
    </div>
  );
}