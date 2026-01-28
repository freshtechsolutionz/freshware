"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
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

const supabase = supabaseBrowser();

export default function SalesPipelineBoard({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  // Filters
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Local editable state (so you can edit without losing UI)
  const [localOpps, setLocalOpps] = useState<Opportunity[]>(opportunities || []);

  // Track save states per opportunity
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<Record<string, string | null>>({});

  // If the server sends new opportunities list (refresh), sync local state
  // (simple approach: only sync when lengths differ)
  if ((opportunities || []).length !== localOpps.length) {
    setLocalOpps(opportunities || []);
  }

  function updateLocal(id: string, patch: Partial<Opportunity>) {
    setLocalOpps((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function saveOpportunity(id: string) {
    const opp = localOpps.find((o) => o.id === id);
    if (!opp) return;

    setSaving((p) => ({ ...p, [id]: true }));
    setSaveError((p) => ({ ...p, [id]: null }));

    const payload = {
      stage: opp.stage ?? "new",
      service_line: opp.service_line ?? null,
      amount: opp.amount ?? 0,
    };

    const { error } = await supabase.from("opportunities").update(payload).eq("id", id);

    if (error) {
      setSaveError((p) => ({ ...p, [id]: error.message }));
      setSaving((p) => ({ ...p, [id]: false }));
      return;
    }

    setSavedAt((p) => ({ ...p, [id]: Date.now() }));
    setSaving((p) => ({ ...p, [id]: false }));
  }

  const filtered = useMemo(() => {
    return (localOpps || []).filter((o) => {
      const stageOk = stageFilter === "all" ? true : (o.stage || "new") === stageFilter;
      const serviceOk =
        serviceFilter === "all" ? true : (o.service_line || "") === serviceFilter;

      const q = search.trim().toLowerCase();
      const searchOk = q.length === 0 ? true : (o.name || "").toLowerCase().includes(q);

      return stageOk && serviceOk && searchOk;
    });
  }, [localOpps, stageFilter, serviceFilter, search]);

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

  // KPI tiles
  const kpis = useMemo(() => {
    const total = filtered.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const won = filtered
      .filter((o) => (o.stage || "new").toLowerCase() === "won")
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);

    // Define “open” as everything not won/lost (adjust if your stages differ)
    const open = filtered
      .filter((o) => {
        const s = (o.stage || "new").toLowerCase();
        return s !== "won" && s !== "lost";
      })
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);

    return {
      total,
      open,
      won,
      count: filtered.length,
    };
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
            <strong>${money(kpis.total)}</strong>
          </div>
        </div>

        <Link href="/dashboard/sales/new">+ Add Opportunity</Link>
      </div>

      {/* KPI Tiles */}
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Total Pipeline</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>${money(kpis.total)}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Open Pipeline</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>${money(kpis.open)}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Won</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>${money(kpis.won)}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Opportunities</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{kpis.count}</div>
        </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{stage}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>${money(stageTotals[stage] || 0)}</div>
            </div>

            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
              {grouped[stage]?.length || 0} items
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(grouped[stage] || []).map((opp) => {
                const id = opp.id;
                const justSaved = savedAt[id] && Date.now() - savedAt[id] < 4000;

                return (
                  <div
                    key={opp.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 10,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 650 }}>{opp.name || "(No name)"}</div>

                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      {/* Stage */}
                      <label style={{ fontSize: 12, opacity: 0.8 }}>
                        Stage
                        <select
                          value={opp.stage || "new"}
                          onChange={(e) => updateLocal(id, { stage: e.target.value })}
                          style={{ width: "100%", padding: 8, marginTop: 4 }}
                        >
                          {SALES_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Service line */}
                      <label style={{ fontSize: 12, opacity: 0.8 }}>
                        Service line
                        <select
                          value={opp.service_line || ""}
                          onChange={(e) =>
                            updateLocal(id, { service_line: e.target.value || null })
                          }
                          style={{ width: "100%", padding: 8, marginTop: 4 }}
                        >
                          <option value="">—</option>
                          {SERVICE_LINES.map((s) => (
                            <option key={s} value={s}>
                              {formatServiceLine(s)}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Amount */}
                      <label style={{ fontSize: 12, opacity: 0.8 }}>
                        Amount ($)
                        <input
                          value={String(opp.amount ?? 0)}
                          onChange={(e) =>
                            updateLocal(id, { amount: Number(e.target.value || 0) })
                          }
                          inputMode="numeric"
                          style={{ width: "100%", padding: 8, marginTop: 4 }}
                        />
                      </label>

                      {/* Save */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <button
                          onClick={() => saveOpportunity(id)}
                          disabled={!!saving[id]}
                          style={{ padding: "8px 10px" }}
                        >
                          {saving[id] ? "Saving..." : "Save"}
                        </button>

                        {justSaved && (
                          <div style={{ fontSize: 12, opacity: 0.8 }}>Saved ✅</div>
                        )}
                      </div>

                      {saveError[id] && (
                        <div style={{ fontSize: 12, color: "crimson" }}>
                          {saveError[id]}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ opacity: 0.8 }}>
                        {opp.created_at ? new Date(opp.created_at).toLocaleDateString() : ""}
                      </div>
                      <div style={{ fontWeight: 700 }}>${money(Number(opp.amount || 0))}</div>
                    </div>
                  </div>
                );
              })}

              {(!grouped[stage] || grouped[stage].length === 0) && (
                <div style={{ opacity: 0.6, fontSize: 12 }}>No opportunities here.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
