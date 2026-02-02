"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
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
  created_at: string | null;
};

const supabase = supabaseBrowser();

function money(n: number) {
  return n.toLocaleString();
}

function safeStage(s: string | null | undefined) {
  return (s || "new").toString();
}

function formatDate(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function SalesPipelineBoard({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  // Filters
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Local editable list
  const [localOpps, setLocalOpps] = useState<Opportunity[]>(opportunities || []);

  // Save states
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<Record<string, string | null>>({});

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Side panel state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => localOpps.find((o) => o.id === selectedId) || null,
    [localOpps, selectedId]
  );

  // Editable draft for panel (so you can Cancel without changing the board)
  type Draft = {
    name: string;
    stage: string;
    service_line: string;
    amount: string; // keep as string for input
  };

  const [draft, setDraft] = useState<Draft | null>(null);

  // Sync list when server data changes
  useEffect(() => {
    setLocalOpps(opportunities || []);
  }, [opportunities]);

  // When selected changes, build a draft
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      name: selected.name || "",
      stage: safeStage(selected.stage),
      service_line: selected.service_line || "",
      amount: String(selected.amount ?? 0),
    });
  }, [selectedId]); // only when opening/changing selection

  function updateLocal(id: string, patch: Partial<Opportunity>) {
    setLocalOpps((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
    );
  }

  async function saveOpportunity(id: string, patch?: Partial<Opportunity>) {
    const current = localOpps.find((o) => o.id === id);
    if (!current) return;

    const next = { ...current, ...(patch || {}) };

    setSaving((p) => ({ ...p, [id]: true }));
    setSaveError((p) => ({ ...p, [id]: null }));

    const payload = {
      name: next.name ?? null,
      stage: safeStage(next.stage),
      service_line: next.service_line ?? null,
      amount: next.amount ?? 0,
    };

    const { error } = await supabase
      .from("opportunities")
      .update(payload)
      .eq("id", id);

    if (error) {
      setSaveError((p) => ({ ...p, [id]: error.message }));
      setSaving((p) => ({ ...p, [id]: false }));
      return;
    }

    // optimistic already applied
    setSavedAt((p) => ({ ...p, [id]: Date.now() }));
    setSaving((p) => ({ ...p, [id]: false }));
  }

  async function updateAndSave(
    id: string,
    patch: Partial<Opportunity>,
    prev: Opportunity
  ) {
    // optimistic UI
    updateLocal(id, patch);

    setSaving((p) => ({ ...p, [id]: true }));
    setSaveError((p) => ({ ...p, [id]: null }));

    const payload: any = {};
    if (patch.name !== undefined) payload.name = patch.name ?? null;
    if (patch.stage !== undefined) payload.stage = safeStage(patch.stage as any);
    if (patch.service_line !== undefined)
      payload.service_line = patch.service_line ?? null;
    if (patch.amount !== undefined) payload.amount = patch.amount ?? 0;

    const { error } = await supabase
      .from("opportunities")
      .update(payload)
      .eq("id", id);

    if (error) {
      // revert
      updateLocal(id, {
        name: prev.name,
        stage: prev.stage,
        service_line: prev.service_line,
        amount: prev.amount,
      });
      setSaveError((p) => ({ ...p, [id]: error.message }));
      setSaving((p) => ({ ...p, [id]: false }));
      return;
    }

    setSavedAt((p) => ({ ...p, [id]: Date.now() }));
    setSaving((p) => ({ ...p, [id]: false }));
  }

  const filtered = useMemo(() => {
    return (localOpps || []).filter((o) => {
      const stageOk =
        stageFilter === "all" ? true : safeStage(o.stage) === stageFilter;

      const serviceOk =
        serviceFilter === "all"
          ? true
          : (o.service_line || "") === serviceFilter;

      const q = search.trim().toLowerCase();
      const searchOk =
        q.length === 0 ? true : (o.name || "").toLowerCase().includes(q);

      return stageOk && serviceOk && searchOk;
    });
  }, [localOpps, stageFilter, serviceFilter, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of SALES_STAGES) map[s] = [];
    for (const opp of filtered) {
      const s = safeStage(opp.stage);
      if (!map[s]) map[s] = [];
      map[s].push(opp);
    }
    return map;
  }, [filtered]);

  const stageTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of SALES_STAGES) totals[s] = 0;
    for (const opp of filtered) {
      const s = safeStage(opp.stage);
      totals[s] = (totals[s] || 0) + Number(opp.amount || 0);
    }
    return totals;
  }, [filtered]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const won = filtered
      .filter((o) => safeStage(o.stage).toLowerCase() === "won")
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const open = filtered
      .filter((o) => {
        const s = safeStage(o.stage).toLowerCase();
        return s !== "won" && s !== "lost";
      })
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);

    return { total, open, won, count: filtered.length };
  }, [filtered]);

  function stagePillClass(stage: string) {
    const s = stage.toLowerCase();
    if (s.includes("won")) return "pill pill-won";
    if (s.includes("lost")) return "pill pill-lost";
    if (s.includes("new")) return "pill pill-new";
    if (s.includes("proposal")) return "pill pill-proposal";
    if (s.includes("negoti")) return "pill pill-negotiation";
    return "pill pill-default";
  }

  // Drop handler for stage column
  async function handleDropOnStage(stage: string) {
    if (!draggingId) return;

    const opp = localOpps.find((o) => o.id === draggingId);
    if (!opp) return;

    const fromStage = safeStage(opp.stage);
    const toStage = stage;

    setDraggingId(null);
    setDragOverStage(null);

    if (fromStage === toStage) return;

    await updateAndSave(draggingId, { stage: toStage }, opp);
  }

  function openPanel(id: string) {
    setSelectedId(id);
  }

  function closePanel() {
    setSelectedId(null);
  }

  async function savePanel() {
    if (!selected || !draft) return;

    const id = selected.id;

    const patch: Partial<Opportunity> = {
      name: draft.name.trim().length ? draft.name.trim() : null,
      stage: draft.stage,
      service_line: draft.service_line || null,
      amount: Number(draft.amount || 0),
    };

    // optimistic update in board immediately
    updateLocal(id, patch);

    await saveOpportunity(id, patch);

    // Keep drawer open (feels premium)
    // If you want it to close after save, uncomment:
    // closePanel();
  }

  const selectedJustSaved =
    selectedId && savedAt[selectedId] && Date.now() - savedAt[selectedId] < 3500;

  return (
    <div className="fw-page">
      {/* TOPBAR */}
      <div className="fw-topbar">
        <div className="fw-topbar-inner">
          <div>
            <div className="fw-title-row">
              <div className="fw-logo-badge">F</div>
              <div>
                <h2 className="fw-title">Freshware Sales Pipeline</h2>
                <div className="fw-subtitle">
                  {filtered.length} opportunities • Total{" "}
                  <span className="fw-strong">${money(kpis.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="fw-actions">
            <div className="fw-link">
              <Link href="/dashboard/sales/new">+ Add Opportunity</Link>
            </div>
          </div>
        </div>

        {/* KPI Tiles */}
        <div className="fw-kpis">
          <div className="fw-kpi">
            <div className="fw-kpi-label">Total Pipeline</div>
            <div className="fw-kpi-value">${money(kpis.total)}</div>
          </div>
          <div className="fw-kpi">
            <div className="fw-kpi-label">Open Pipeline</div>
            <div className="fw-kpi-value">${money(kpis.open)}</div>
          </div>
          <div className="fw-kpi">
            <div className="fw-kpi-label">Won</div>
            <div className="fw-kpi-value">${money(kpis.won)}</div>
          </div>
          <div className="fw-kpi">
            <div className="fw-kpi-label">Opportunities</div>
            <div className="fw-kpi-value">{kpis.count}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="fw-filters">
          <div className="fw-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities…"
            />
          </div>

          <select
            className="fw-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="all">All stages</option>
            {SALES_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="fw-select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="all">All service lines</option>
            {SERVICE_LINES.map((s) => (
              <option key={s} value={s}>
                {formatServiceLine(s)}
              </option>
            ))}
          </select>

          <button
            className="fw-btn fw-btn-ghost"
            onClick={() => {
              setSearch("");
              setStageFilter("all");
              setServiceFilter("all");
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* BOARD */}
      <div className="fw-board-wrap">
        <div className="fw-board">
          {SALES_STAGES.map((stage) => {
            const isOver = dragOverStage === stage;
            const showDropHint = isOver && draggingId;

            return (
              <div
                key={stage}
                className={`fw-col ${isOver ? "fw-col-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={() => {
                  setDragOverStage((prev) => (prev === stage ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnStage(stage);
                }}
              >
                <div className="fw-col-head">
                  <div className="fw-col-title">{stage}</div>
                  <div className="fw-col-meta">
                    <span className="fw-col-items">
                      {grouped[stage]?.length || 0} deals
                    </span>
                    <span className="fw-col-total">
                      ${money(stageTotals[stage] || 0)}
                    </span>
                  </div>
                </div>

                <div className="fw-col-body">
                  {showDropHint && (
                    <div className="fw-drop-hint">
                      <div className="fw-drop-hint-title">Drop to move</div>
                      <div className="fw-drop-hint-sub">
                        Stage → <span className="fw-strong">{stage}</span>
                      </div>
                    </div>
                  )}

                  <div className="fw-cards">
                    {(grouped[stage] || []).map((opp) => {
                      const id = opp.id;
                      const isDragging = draggingId === id;

                      return (
                        <button
                          key={id}
                          type="button"
                          className={`fw-card fw-card-btn ${
                            isDragging ? "fw-card-dragging" : ""
                          }`}
                          onClick={() => openPanel(id)}
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(id);
                            e.dataTransfer.setData("text/plain", id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverStage(null);
                          }}
                        >
                          <div className="fw-card-top">
                            <div className="fw-card-title">
                              {opp.name || "(No name)"}
                            </div>
                            <div className={stagePillClass(safeStage(opp.stage))}>
                              {safeStage(opp.stage)}
                            </div>
                          </div>

                          <div className="fw-card-sub">
                            {formatServiceLine(opp.service_line || "") || "—"}
                          </div>

                          <div className="fw-card-amount-row">
                            <div className="fw-card-amount">
                              ${money(Number(opp.amount || 0))}
                            </div>
                            <div className="fw-card-date">
                              {formatDate(opp.created_at)}
                            </div>
                          </div>

                          <div className="fw-card-hint">
                            Click to edit • Drag to move
                          </div>
                        </button>
                      );
                    })}

                    {(!grouped[stage] || grouped[stage].length === 0) && (
                      <div className="fw-empty">
                        <div className="fw-empty-title">No opportunities</div>
                        <div className="fw-empty-sub">
                          Drag a card here or add a new opportunity.
                        </div>
                      </div>
                    )}
                  </div>

                  {isOver && draggingId && <div className="fw-drop-strip" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SIDE PANEL */}
      {selected && draft && (
        <div className="fw-drawer-overlay" onClick={closePanel}>
          <div
            className="fw-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="fw-drawer-head">
              <div>
                <div className="fw-drawer-title">
                  {selected.name || "Opportunity"}
                </div>
                <div className="fw-drawer-sub">
                  {formatServiceLine(selected.service_line || "") || "—"} •{" "}
                  {formatDate(selected.created_at)}
                </div>
              </div>

              <button className="fw-drawer-close" onClick={closePanel}>
                ✕
              </button>
            </div>

            <div className="fw-drawer-body">
              <div className="fw-drawer-grid">
                <div className="fw-field">
                  <label>Name</label>
                  <input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, name: e.target.value } : d))
                    }
                    placeholder="Opportunity name…"
                  />
                </div>

                <div className="fw-field">
                  <label>Stage</label>
                  <select
                    value={draft.stage}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, stage: e.target.value } : d))
                    }
                  >
                    {SALES_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fw-field">
                  <label>Service line</label>
                  <select
                    value={draft.service_line}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, service_line: e.target.value } : d
                      )
                    }
                  >
                    <option value="">—</option>
                    {SERVICE_LINES.map((s) => (
                      <option key={s} value={s}>
                        {formatServiceLine(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fw-field">
                  <label>Amount</label>
                  <input
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, amount: e.target.value } : d
                      )
                    }
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
              </div>

              {selectedId && saveError[selectedId] && (
                <div className="fw-error" style={{ marginTop: 10 }}>
                  {saveError[selectedId]}
                </div>
              )}

              <div className="fw-drawer-actions">
                <button className="fw-btn fw-btn-ghost" onClick={closePanel}>
                  Close
                </button>

                <button
                  className="fw-btn fw-btn-primary"
                  onClick={savePanel}
                  disabled={selectedId ? !!saving[selectedId] : false}
                >
                  {selectedId && saving[selectedId] ? "Saving…" : "Save changes"}
                </button>

                <div className="fw-drawer-status">
                  {selectedJustSaved ? "Saved ✅" : ""}
                </div>
              </div>
            </div>

            <div className="fw-drawer-footer">
              <div className="fw-muted">
                Tip: Drag cards on the board to move stages fast.
              </div>
            </div>
          </div>
        </div>
      )}

    
    </div>
  );
}
