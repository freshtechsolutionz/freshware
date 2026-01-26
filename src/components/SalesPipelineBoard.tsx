"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SALES_STAGES, SERVICE_LINES, formatServiceLine } from "@/lib/salesConfig";

type Opportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  service_line: string | null;
  amount: number | null;
  created_at: string | null;
};

function money(n: number) {
  return n.toLocaleString();
}

export default function SalesPipelineBoard({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const filtered = useMemo(() => {
    return (opportunities || []).filter((o) => {
      const stageOk = stageFilter === "all" ? true : (o.stage || "new") === stageFilter;
      const serviceOk =
        serviceFilter === "all" ? true : (o.service_line || "") === serviceFilter;

      const q = search.trim().toLowerCase();
      const searchOk =
        q.length === 0 ? true : (o.name || "").toLowerCase().includes(q);

      return stageOk && serviceOk && searchOk;
    });
  }, [opportunities, stageFilter, serviceFilter, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of SALES_STAGES) map[s] = [];
    for (const opp of filtered) {
      const s = opp.stage || "new";
      if (!map[s]) map[s] = [];
      map[s].push(opp);
    }
    return map;
  }, [filtered]);

  const stageTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of SALES_STAGES) totals[s] = 0;
    for (const opp of filtered) {
      const s = opp.stage || "new";
      totals[s] = (totals[s] || 0) + Number(opp.amount || 0);
    }
    return totals;
  }, [filtered]);

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Sales Pipeline</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            {filtered.length} opportunities • Total{" "}
            <strong>
              $
              {money(
                filtered.reduce((sum, o) => sum + Number(o.amount || 0), 0)
              )}
            </strong>
          </div>
        </div>

        <Link href="/dashboard/sales/new">+ Add Opportunity</Link>
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search opportunity name..."
          style={{ padding: 8, minWidth: 240 }}
        />

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          style={{ padding: 8 }}
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
          style={{ padding: 8 }}
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
          style={{ padding: "8px 10px" }}
        >
          Reset
        </button>
      </div>

      {/* Board */}
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(260px, 1fr))",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 10,
        }}
      >
        {SALES_STAGES.map((stage) => (
          <div
            key={stage}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              minHeight: 300,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>{stage}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                ${money(stageTotals[stage] || 0)}
              </div>
            </div>

            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
              {grouped[stage]?.length || 0} items
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(grouped[stage] || []).map((opp) => (
                <div
                  key={opp.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 10,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 650 }}>
                    {opp.name || "(No name)"}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                    {formatServiceLine(opp.service_line || "") || "—"}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ opacity: 0.8 }}>
                      {opp.created_at
                        ? new Date(opp.created_at).toLocaleDateString()
                        : ""}
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      ${money(Number(opp.amount || 0))}
                    </div>
                  </div>
                </div>
              ))}

              {(!grouped[stage] || grouped[stage].length === 0) && (
                <div style={{ opacity: 0.6, fontSize: 12 }}>
                  No opportunities here.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
