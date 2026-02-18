"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Action =
  | { type: "nav"; label: string; href: string; keywords?: string }
  | { type: "agent"; label: string; command: string; keywords?: string };

function cls(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function normalize(s: string) {
  return s.toLowerCase().trim();
}

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global actions (edit labels anytime)
  const actions: Action[] = useMemo(
    () => [
      { type: "nav", label: "Dashboard", href: "/dashboard", keywords: "home overview" },
      { type: "nav", label: "Opportunities", href: "/dashboard/opportunities", keywords: "pipeline deals sales" },
      { type: "nav", label: "Projects", href: "/dashboard/projects", keywords: "delivery status" },
      { type: "nav", label: "Tasks", href: "/dashboard/tasks", keywords: "todo blockers overdue" },
      { type: "nav", label: "Meetings", href: "/dashboard/meetings", keywords: "calendar ycbm bookings" },

      { type: "nav", label: "Overdue Tasks Report", href: "/dashboard/reports/overdue", keywords: "late past due blocked" },
      { type: "nav", label: "Pipeline Drilldown", href: "/dashboard/reports/pipeline", keywords: "stages amounts deals" },
      { type: "nav", label: "Project Health Heatmap", href: "/dashboard/reports/projects-health", keywords: "risk red yellow green" },

      // Agent commands (answers inside agent)
      { type: "agent", label: "AI: Today’s CEO Focus", command: "What should I focus on today as CEO? Give me 5 priorities with reasons and next actions.", keywords: "focus priorities plan" },
      { type: "agent", label: "AI: Executive Weekly Report", command: "Generate my weekly executive report: wins, risks, pipeline, project health, overdue tasks, next best actions.", keywords: "weekly report exec" },
      { type: "agent", label: "AI: Summarize Pipeline + Next Best Actions", command: "Summarize pipeline (by stage) and give next best actions for the top deals.", keywords: "pipeline actions stages" },
      { type: "agent", label: "AI: Overdue Tasks – What to Clear First", command: "Review overdue tasks and tell me what to clear first and who should do it.", keywords: "overdue tasks clear" },
      { type: "agent", label: "AI: Project Risks + Fix Plan", command: "Show me the biggest risks across projects and what to fix first. Be specific.", keywords: "project risk plan" },
    ],
    []
  );

  const filtered = useMemo(() => {
    const query = normalize(q);
    if (!query) return actions;
    return actions
      .map((a) => {
        const hay = normalize(a.label + " " + (a.keywords || "") + ("href" in a ? " " + a.href : ""));
        const score = hay.includes(query) ? 2 : 0;
        return { a, score };
      })
      .filter((x) => x.score > 0)
      .map((x) => x.a);
  }, [q, actions]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      const meta = e.metaKey || e.ctrlKey;

      if (meta && isK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[active];
        if (!item) return;
        runAction(item);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, active]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function runAction(a: Action) {
    setOpen(false);

    if (a.type === "nav") {
      if (a.href !== pathname) router.push(a.href);
      return;
    }

    // Send to agent (AgentPanel listens for this event)
    window.dispatchEvent(
      new CustomEvent("freshware:agentCommand", {
        detail: { text: a.command },
      })
    );
  }

  if (!open) {
    // small non-intrusive hint area (optional)
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000]">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={() => setOpen(false)}
        aria-label="Close command palette"
        type="button"
      />

      <div className="absolute left-1/2 top-20 w-[92vw] max-w-2xl -translate-x-1/2">
        <div className="fw-card-strong p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-900">Command Palette</div>
            <div className="fw-chip">⌘K / Ctrl+K</div>
          </div>

          <div className="mt-3">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="fw-input"
              placeholder="Search actions (e.g. ‘pipeline’, ‘projects’, ‘weekly report’)..."
            />
          </div>

          <div className="mt-3 max-h-[380px] overflow-auto fw-scroll">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-zinc-600">No matches.</div>
            ) : (
              <div className="space-y-2 p-1">
                {filtered.map((a, idx) => {
                  const isActive = idx === active;
                  const tag = a.type === "agent" ? "AI Command" : "Navigate";

                  return (
                    <button
                      key={a.type + ":" + a.label + ":" + idx}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => runAction(a)}
                      className={cls(
                        "w-full text-left rounded-2xl border border-black/10 p-3 transition",
                        isActive ? "bg-black text-white border-black/20" : "bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={cls("text-sm font-semibold", isActive ? "text-white" : "text-zinc-900")}>
                            {a.label}
                          </div>
                          {"href" in a ? (
                            <div className={cls("mt-1 text-xs", isActive ? "text-white/80" : "text-zinc-600")}>
                              {a.href}
                            </div>
                          ) : (
                            <div className={cls("mt-1 text-xs", isActive ? "text-white/80" : "text-zinc-600")}>
                              {a.command}
                            </div>
                          )}
                        </div>
                        <span className={cls("fw-chip", isActive ? "bg-white/15 text-white border-white/20" : "")}>
                          {tag}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
            <div>↑ ↓ to navigate · Enter to run · Esc to close</div>
            <div>
              <Link href="/dashboard/profile" className="underline">
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
