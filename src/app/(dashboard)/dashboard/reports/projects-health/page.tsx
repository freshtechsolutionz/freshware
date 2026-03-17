"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type HealthCounts = { GREEN: number; YELLOW: number; RED: number; UNKNOWN: number };

type ProjectHealthRow = {
  id: string;
  name: string | null;
  status: string | null;
  stage: string | null;
  start_date: string | null;
  due_date: string | null;
  computed_health: string;
};

type ProjectsHealthResponse = {
  counts: HealthCounts;
  projects: ProjectHealthRow[];
};

type HealthFilter = "ALL" | "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
type SortMode = "RISK" | "DEADLINE" | "NAME";

async function fetchJson(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    redirect: "manual",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "N/A";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
}

function daysTo(due: string | null | undefined) {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function healthClasses(h: string) {
  const v = String(h || "").toUpperCase();
  if (v === "GREEN") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (v === "YELLOW") return "border-amber-200 bg-amber-50 text-amber-800";
  if (v === "RED") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function chipClasses(h: string) {
  const v = String(h || "").toUpperCase();
  if (v === "GREEN") return "border-emerald-200 bg-emerald-100 text-emerald-900";
  if (v === "YELLOW") return "border-amber-200 bg-amber-100 text-amber-900";
  if (v === "RED") return "border-red-200 bg-red-100 text-red-900";
  return "border-gray-200 bg-gray-100 text-gray-700";
}

function stageHeat(stage: string | null | undefined) {
  const s = String(stage || "").toLowerCase();
  if (s.includes("launch")) return 92;
  if (s.includes("qa")) return 82;
  if (s.includes("development")) return 74;
  if (s.includes("design")) return 58;
  if (s.includes("planning")) return 42;
  if (s.includes("support")) return 35;
  if (s.includes("intake")) return 25;
  return 50;
}

function statusPenalty(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  if (s.includes("on_hold")) return 20;
  if (s.includes("hold")) return 20;
  if (s.includes("blocked")) return 25;
  if (s.includes("cancel")) return 30;
  if (s.includes("active")) return 8;
  if (s.includes("planning")) return 4;
  if (s.includes("completed")) return -20;
  return 10;
}

function healthBase(health: string | null | undefined) {
  const h = String(health || "").toUpperCase();
  if (h === "RED") return 92;
  if (h === "YELLOW") return 68;
  if (h === "GREEN") return 26;
  return 46;
}

function deadlinePenalty(due: string | null | undefined) {
  const d = daysTo(due);
  if (d === null) return 12;
  if (d < 0) return 35;
  if (d <= 3) return 28;
  if (d <= 7) return 20;
  if (d <= 14) return 12;
  if (d <= 30) return 4;
  return -6;
}

function riskScore(p: ProjectHealthRow) {
  const raw =
    healthBase(p.computed_health) +
    statusPenalty(p.status) +
    deadlinePenalty(p.due_date) +
    Math.round(stageHeat(p.stage) * 0.12);

  return Math.max(0, Math.min(100, raw));
}

function riskBand(score: number) {
  if (score >= 80) return "RED";
  if (score >= 55) return "YELLOW";
  if (score >= 30) return "GREEN";
  return "UNKNOWN";
}

function riskLabel(score: number) {
  if (score >= 85) return "Critical";
  if (score >= 70) return "Hot";
  if (score >= 55) return "Watch";
  if (score >= 30) return "Stable";
  return "Cool";
}

function projectSuggestions(p: ProjectHealthRow, score: number) {
  const d = daysTo(p.due_date);
  const stage = String(p.stage || "").toLowerCase();
  const status = String(p.status || "").toLowerCase();
  const items: string[] = [];

  if (score >= 80) {
    items.push("Schedule an executive recovery review within 24 hours.");
  }
  if (d !== null && d < 0) {
    items.push("Reset timeline immediately and confirm a revised delivery plan.");
  } else if (d !== null && d <= 7) {
    items.push("Assign daily accountability until the next milestone lands.");
  }
  if (status.includes("hold")) {
    items.push("Clarify what is blocking forward motion and assign one owner to unblock it.");
  }
  if (stage.includes("launch")) {
    items.push("Audit launch-readiness, approvals, and client communication today.");
  }
  if (stage.includes("development") || stage.includes("qa")) {
    items.push("Review scope, testing, and handoff risk before it becomes launch delay.");
  }
  if (!items.length) {
    items.push("Maintain momentum and keep weekly executive visibility on delivery health.");
  }

  return items.slice(0, 3);
}

function portfolioActions(rows: ProjectHealthRow[]) {
  const red = rows.filter((p) => riskBand(riskScore(p)) === "RED").length;
  const yellow = rows.filter((p) => riskBand(riskScore(p)) === "YELLOW").length;
  const overdue = rows.filter((p) => {
    const d = daysTo(p.due_date);
    return d !== null && d < 0;
  }).length;
  const onHold = rows.filter((p) => String(p.status || "").toLowerCase().includes("hold")).length;

  const items: string[] = [];

  if (red > 0) items.push(`You have ${red} red project${red === 1 ? "" : "s"} needing immediate executive attention.`);
  if (yellow > 0) items.push(`${yellow} yellow project${yellow === 1 ? "" : "s"} should move into a watch-list cadence this week.`);
  if (overdue > 0) items.push(`${overdue} project${overdue === 1 ? " is" : "s are"} overdue and need timeline reset or scope correction.`);
  if (onHold > 0) items.push(`${onHold} project${onHold === 1 ? " is" : "s are"} on hold — unblock or formally pause expectations.`);
  if (!items.length) items.push("Portfolio looks healthy. Keep delivery discipline and preserve green projects.");

  return items.slice(0, 4);
}

function heatColor(score: number) {
  if (score >= 80) return "from-red-500 via-red-400 to-orange-400";
  if (score >= 55) return "from-amber-500 via-yellow-400 to-orange-300";
  if (score >= 30) return "from-emerald-500 via-lime-400 to-teal-300";
  return "from-slate-400 via-slate-300 to-slate-200";
}

function glowClass(score: number) {
  if (score >= 80) return "shadow-[0_0_30px_rgba(239,68,68,0.35)]";
  if (score >= 55) return "shadow-[0_0_24px_rgba(245,158,11,0.28)]";
  if (score >= 30) return "shadow-[0_0_22px_rgba(16,185,129,0.22)]";
  return "shadow-[0_0_14px_rgba(148,163,184,0.18)]";
}

export default function ProjectsHealthReportPage() {
  const [data, setData] = useState<ProjectsHealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<HealthFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("RISK");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const json = (await fetchJson("/api/ceo/projects-health")) as ProjectsHealthResponse;
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Unable to reach projects health API");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return (data?.projects || []).map((p) => {
      const score = riskScore(p);
      const band = riskBand(score);
      return {
        ...p,
        score,
        band,
        dleft: daysTo(p.due_date),
        suggestions: projectSuggestions(p, score),
      };
    });
  }, [data]);

  const rows = useMemo(() => {
    const filtered =
      filter === "ALL"
        ? enriched
        : enriched.filter((p) => String(p.band || "").toUpperCase() === filter);

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "NAME") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }

      if (sortMode === "DEADLINE") {
        return (a.dleft ?? 999999) - (b.dleft ?? 999999);
      }

      return b.score - a.score;
    });

    return sorted;
  }, [enriched, filter, sortMode]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [rows, selectedId]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  const total =
    (data?.counts.GREEN || 0) +
    (data?.counts.YELLOW || 0) +
    (data?.counts.RED || 0) +
    (data?.counts.UNKNOWN || 0);

  const redPct = total ? Math.round(((data?.counts.RED || 0) / total) * 100) : 0;
  const yellowPct = total ? Math.round(((data?.counts.YELLOW || 0) / total) * 100) : 0;
  const greenPct = total ? Math.round(((data?.counts.GREEN || 0) / total) * 100) : 0;
  const unknownPct = Math.max(0, 100 - redPct - yellowPct - greenPct);

  const portfolioRiskScore = useMemo(() => {
    if (!enriched.length) return 0;
    return Math.round(
      enriched.reduce((sum, p) => sum + p.score, 0) / enriched.length
    );
  }, [enriched]);

  const portfolioPressureLabel = riskLabel(portfolioRiskScore);
  const actionItems = useMemo(() => portfolioActions(enriched), [enriched]);

  const redProjects = rows.filter((r) => r.band === "RED");
  const yellowProjects = rows.filter((r) => r.band === "YELLOW");
  const greenProjects = rows.filter((r) => r.band === "GREEN");

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border bg-background">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.08),transparent_26%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.07),transparent_28%),radial-gradient(circle_at_bottom_center,rgba(16,185,129,0.07),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Reports</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                Project Health Heat Map
              </div>
              <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Executive risk radar for the entire portfolio. Use this page to spot delivery heat,
                focus on the right projects, and drive red workstreams back to green.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/projects"
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Back to Projects
              </Link>
              <button
                onClick={load}
                disabled={busy}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              >
                {busy ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {err ? (
            <div className="relative mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "ALL"
              ? "bg-slate-950 text-white shadow-lg"
              : "bg-white hover:shadow-md"
          }`}
        >
          <div className="text-xs opacity-80">Portfolio</div>
          <div className="mt-3 text-3xl font-semibold">{total}</div>
          <div className="mt-2 text-sm opacity-80">All active signals in the map</div>
        </button>

        <button
          onClick={() => setFilter("GREEN")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "GREEN"
              ? "bg-emerald-600 text-white shadow-lg"
              : "bg-emerald-50 hover:shadow-md"
          }`}
        >
          <div className="text-xs opacity-80">Green</div>
          <div className="mt-3 text-3xl font-semibold">{data?.counts.GREEN || 0}</div>
          <div className="mt-2 text-sm opacity-80">{greenPct}% on track</div>
        </button>

        <button
          onClick={() => setFilter("YELLOW")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "YELLOW"
              ? "bg-amber-500 text-white shadow-lg"
              : "bg-amber-50 hover:shadow-md"
          }`}
        >
          <div className="text-xs opacity-80">Yellow</div>
          <div className="mt-3 text-3xl font-semibold">{data?.counts.YELLOW || 0}</div>
          <div className="mt-2 text-sm opacity-80">{yellowPct}% watch list</div>
        </button>

        <button
          onClick={() => setFilter("RED")}
          className={`rounded-3xl border p-5 text-left transition ${
            filter === "RED"
              ? "bg-red-600 text-white shadow-lg"
              : "bg-red-50 hover:shadow-md"
          }`}
        >
          <div className="text-xs opacity-80">Red</div>
          <div className="mt-3 text-3xl font-semibold">{data?.counts.RED || 0}</div>
          <div className="mt-2 text-sm opacity-80">{redPct}% immediate attention</div>
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold">Interactive Heat Surface</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Tap a hotspot to inspect the project and see how to cool it down.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="rounded-2xl border px-3 py-2 text-sm"
                >
                  <option value="RISK">Sort by Risk</option>
                  <option value="DEADLINE">Sort by Deadline</option>
                  <option value="NAME">Sort by Name</option>
                </select>

                <button
                  onClick={() => setFilter("ALL")}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
                    filter === "ALL" ? "bg-slate-900 text-white" : "bg-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("RED")}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
                    filter === "RED" ? "bg-red-600 text-white" : "bg-white"
                  }`}
                >
                  Red
                </button>
                <button
                  onClick={() => setFilter("YELLOW")}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
                    filter === "YELLOW" ? "bg-amber-500 text-white" : "bg-white"
                  }`}
                >
                  Yellow
                </button>
                <button
                  onClick={() => setFilter("GREEN")}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${
                    filter === "GREEN" ? "bg-emerald-600 text-white" : "bg-white"
                  }`}
                >
                  Green
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-black/10 bg-slate-950 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Portfolio Temperature</div>
                  <div className="mt-1 text-xs text-slate-300">
                    Risk score {portfolioRiskScore}/100 · {portfolioPressureLabel}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full bg-red-500/20 px-2 py-1">Red</span>
                  <span className="rounded-full bg-amber-400/20 px-2 py-1">Yellow</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1">Green</span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_26%),radial-gradient(circle_at_35%_45%,rgba(245,158,11,0.14),transparent_26%),radial-gradient(circle_at_70%_65%,rgba(16,185,129,0.10),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))] p-4 sm:p-5">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:26px_26px]" />

                <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((p, index) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`group relative overflow-hidden rounded-3xl border border-white/10 p-4 text-left transition duration-200 hover:scale-[1.01] ${
                        selectedId === p.id
                          ? "ring-2 ring-white/60"
                          : ""
                      } ${glowClass(p.score)}`}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${heatColor(
                          p.score
                        )} opacity-[0.18] group-hover:opacity-[0.24]`}
                      />
                      {p.score >= 80 ? (
                        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-500/25 blur-2xl" />
                      ) : null}

                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="line-clamp-1 text-sm font-semibold text-white">
                              {p.name || p.id}
                            </div>
                            <div className="mt-1 text-xs text-slate-300">
                              {p.stage || "N/A"} · {p.status || "N/A"}
                            </div>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClasses(
                              p.band
                            )}`}
                          >
                            {p.band}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[10px] uppercase tracking-wide text-slate-300">
                              Heat
                            </div>
                            <div className="mt-1 text-xl font-semibold text-white">
                              {p.score}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[10px] uppercase tracking-wide text-slate-300">
                              Due
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {p.dleft === null
                                ? "N/A"
                                : p.dleft < 0
                                ? `${Math.abs(p.dleft)} overdue`
                                : `${p.dleft} left`}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 h-2.5 w-full rounded-full bg-white/10">
                          <div
                            className={`h-2.5 rounded-full bg-gradient-to-r ${heatColor(
                              p.score
                            )}`}
                            style={{ width: `${Math.max(8, p.score)}%` }}
                          />
                        </div>

                        <div className="mt-3 text-xs text-slate-300">
                          {riskLabel(p.score)} signal
                        </div>
                      </div>
                    </button>
                  ))}

                  {!rows.length && !busy ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                      No projects found for this filter.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">Portfolio Risk Bar</div>
              <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="flex h-full w-full">
                  <div className="bg-red-500" style={{ width: `${redPct}%` }} />
                  <div className="bg-amber-400" style={{ width: `${yellowPct}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${greenPct}%` }} />
                  <div className="bg-slate-400" style={{ width: `${unknownPct}%` }} />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Red = immediate executive attention. Yellow = watch list. Green = on track.
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">CEO Recovery Console</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Use this to decide where to intervene first.
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Portfolio pressure
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{portfolioRiskScore}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {portfolioPressureLabel} portfolio
                  </div>
                </div>

                <div className="rounded-2xl border bg-red-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-red-700">
                    Red hotspots
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-red-900">
                    {redProjects.length}
                  </div>
                  <div className="mt-1 text-sm text-red-800">
                    Highest priority projects in the map
                  </div>
                </div>

                <div className="rounded-2xl border bg-amber-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-amber-700">
                    Watch list
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-amber-900">
                    {yellowProjects.length}
                  </div>
                  <div className="mt-1 text-sm text-amber-800">
                    Yellow projects that can still be recovered early
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">Move Red Back to Green</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Suggested portfolio-level interventions.
              </div>

              <div className="mt-4 space-y-3">
                {actionItems.map((item, index) => (
                  <div key={index} className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold">Focused Project View</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Select any hotspot to inspect and act.
              </div>

              {selected ? (
                <div className="mt-4 space-y-4">
                  <div className={`rounded-3xl border p-4 ${healthClasses(selected.band)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">
                          {selected.name || selected.id}
                        </div>
                        <div className="mt-1 text-sm opacity-80">
                          Stage: {selected.stage || "N/A"} · Status: {selected.status || "N/A"}
                        </div>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${chipClasses(selected.band)}`}>
                        {selected.band}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border bg-white/70 p-3">
                        <div className="text-[10px] uppercase tracking-wide opacity-70">Risk</div>
                        <div className="mt-1 text-2xl font-semibold">{selected.score}</div>
                      </div>
                      <div className="rounded-2xl border bg-white/70 p-3">
                        <div className="text-[10px] uppercase tracking-wide opacity-70">Deadline</div>
                        <div className="mt-1 text-sm font-semibold">
                          {selected.dleft === null
                            ? "N/A"
                            : selected.dleft < 0
                            ? `${Math.abs(selected.dleft)} days overdue`
                            : `${selected.dleft} days left`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm opacity-80">
                      Start: {fmtDate(selected.start_date)} · Due: {fmtDate(selected.due_date)}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="text-sm font-semibold">Executive suggestions</div>
                    <div className="mt-3 space-y-2">
                      {selected.suggestions.map((s, i) => (
                        <div key={i} className="rounded-2xl border bg-white p-3 text-sm text-slate-700">
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/projects/${selected.id}`}
                      className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                    >
                      Open Project Command Center
                    </Link>
                    <button
                      onClick={() => {
                        setFilter(selected.band as HealthFilter);
                      }}
                      className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                    >
                      Filter to {selected.band}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
                  Select a project hotspot to inspect it here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-background p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold">Project Cards</div>
            <div className="text-sm text-muted-foreground">
              Click any card to jump into the live project command center.
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {rows.length} project{rows.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`rounded-3xl border p-4 text-left transition hover:shadow-md ${
                selectedId === p.id ? "ring-2 ring-black/10" : ""
              } ${healthClasses(p.band)}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{p.name || p.id}</div>
                  <div className="mt-1 text-sm opacity-80">
                    Stage: {p.stage || "N/A"} • Status: {p.status || "N/A"}
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    Start: {fmtDate(p.start_date)} • Due: {fmtDate(p.due_date)}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold bg-white/70`}>
                    {p.band}
                  </span>
                  <div className="text-sm font-semibold">
                    Risk {p.score}
                  </div>
                  {p.dleft !== null ? (
                    <div className="text-xs font-medium">
                      {p.dleft < 0 ? `${Math.abs(p.dleft)} days overdue` : `${p.dleft} days left`}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 h-2.5 w-full rounded-full bg-white/60">
                <div
                  className={`h-2.5 rounded-full bg-gradient-to-r ${heatColor(p.score)}`}
                  style={{ width: `${Math.max(8, p.score)}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {p.suggestions.slice(0, 2).map((s, i) => (
                  <span key={i} className="rounded-full border bg-white/70 px-3 py-1 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </button>
          ))}

          {!rows.length && !busy ? (
            <div className="text-sm text-muted-foreground">No projects found.</div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickBucket
          title="Red Zone"
          subtitle="Immediate executive action"
          rows={redProjects.slice(0, 4)}
          tone="red"
        />
        <QuickBucket
          title="Yellow Zone"
          subtitle="Save these before they turn red"
          rows={yellowProjects.slice(0, 4)}
          tone="yellow"
        />
        <QuickBucket
          title="Green Zone"
          subtitle="Protect what is working"
          rows={greenProjects.slice(0, 4)}
          tone="green"
        />
      </div>
    </div>
  );
}

function QuickBucket(props: {
  title: string;
  subtitle: string;
  rows: Array<
    ProjectHealthRow & {
      score: number;
      band: string;
      dleft: number | null;
      suggestions: string[];
    }
  >;
  tone: "red" | "yellow" | "green";
}) {
  const toneClasses =
    props.tone === "red"
      ? "border-red-200 bg-red-50"
      : props.tone === "yellow"
      ? "border-amber-200 bg-amber-50"
      : "border-emerald-200 bg-emerald-50";

  return (
    <div className={`rounded-3xl border p-5 ${toneClasses}`}>
      <div className="text-lg font-semibold">{props.title}</div>
      <div className="mt-1 text-sm opacity-80">{props.subtitle}</div>

      <div className="mt-4 space-y-3">
        {props.rows.map((row) => (
          <Link
            key={row.id}
            href={`/dashboard/projects/${row.id}`}
            className="block rounded-2xl border bg-white/80 p-4 transition hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{row.name || row.id}</div>
                <div className="mt-1 text-xs opacity-70">
                  {row.stage || "N/A"} · {row.status || "N/A"}
                </div>
              </div>
              <div className="text-sm font-semibold">{row.score}</div>
            </div>
          </Link>
        ))}

        {!props.rows.length ? (
          <div className="rounded-2xl border bg-white/70 p-4 text-sm opacity-75">
            No projects in this bucket.
          </div>
        ) : null}
      </div>
    </div>
  );
}