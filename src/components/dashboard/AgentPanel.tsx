"use client";

import { useEffect, useMemo, useState } from "react";

type AgentPanelProps = {
  accountId: string;
  accountName: string;
  viewerId: string;
};

type Msg = { role: "assistant" | "user"; text: string };

function cls(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    const txt = await res.text();
    throw new Error(`Non-JSON response (${res.status}). ${txt.slice(0, 180)}`);
  }
  return res.json();
}

export default function AgentPanel(_: AgentPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text:
        "Command Agent online.\n\nTry:\n- What should I focus on today?\n- Summarize pipeline + next best actions\n- Create a task: Follow up with top 3 prospects due Friday 2pm CST\n- Show project risks + fix plan",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  function pushUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
  }
  function pushAssistant(text: string) {
    setMessages((m) => [...m, { role: "assistant", text }]);
  }

  async function sendAgent(text: string) {
    const msg = text.trim();
    if (!msg) return;

    pushUser(msg);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await safeJson(res);
      pushAssistant(typeof data?.reply === "string" ? data.reply : "No response.");
    } catch (e: any) {
      pushAssistant(`Agent error: ${e?.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function weeklyReport() {
    setBusy(true);
    try {
      pushUser("Weekly executive report");
      const res = await fetch("/api/ceo/weekly-report", { cache: "no-store" });
      const data = await safeJson(res);
      if (data?.error) throw new Error(data.error);
      pushAssistant(String(data.text || "No report returned."));
    } catch (e: any) {
      pushAssistant(`Weekly report error: ${e?.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  // Listen for Command Palette “AI commands”
  useEffect(() => {
    function onCmd(e: any) {
      const text = e?.detail?.text;
      if (typeof text === "string" && text.trim()) {
        sendAgent(text);
      }
    }
    window.addEventListener("freshware:agentCommand", onCmd as any);
    return () => window.removeEventListener("freshware:agentCommand", onCmd as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fw-card-strong p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-tight text-zinc-900">Command Agent</div>
          <div className="mt-1 text-sm text-zinc-600">Reports · Drilldowns · Actions</div>
        </div>
        <span className="fw-chip">{busy ? "Working" : "Online"}</span>
      </div>

      {/* Buttons now run AI commands inside the agent (not navigation) */}
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={weeklyReport} disabled={busy} className="fw-btn h-11 text-sm disabled:opacity-60">
          Weekly Report
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => sendAgent("Review overdue tasks. Prioritize the top 10 by urgency and assign who should do what next.")}
          className="fw-btn h-11 text-sm disabled:opacity-60"
        >
          Overdue – Prioritize
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => sendAgent("Summarize pipeline by stage and list top deals with next best actions to move them forward.")}
          className="fw-btn h-11 text-sm disabled:opacity-60"
        >
          Pipeline – Actions
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => sendAgent("Analyze project health. Identify the riskiest projects and provide a fix plan for each.")}
          className="fw-btn h-11 text-sm disabled:opacity-60"
        >
          Projects – Risks
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-900">Command Console</div>
          <div className="text-xs text-zinc-600">Enter to send · Shift+Enter for newline</div>
        </div>

        <div className="fw-scroll max-h-[340px] overflow-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={cls(
                "rounded-2xl border border-black/10 p-3",
                m.role === "user" ? "bg-black text-white border-black/20" : "bg-white text-zinc-900"
              )}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed m-0">{m.text}</pre>
            </div>
          ))}
        </div>

        <div className="border-t border-black/10 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canSend) {
                  e.preventDefault();
                  sendAgent(input);
                }
              }}
              className="fw-input"
              placeholder="Ask a CEO question or issue a command..."
            />
            <button
              onClick={() => sendAgent(input)}
              disabled={!canSend}
              className={cls(
                "h-11 rounded-xl px-5 text-sm font-semibold",
                canSend ? "bg-black text-white hover:opacity-90" : "bg-black/20 text-white/70"
              )}
              type="button"
            >
              Send
            </button>
          </div>

          <div className="mt-2 text-[11px] text-zinc-600">
            Tip: Press <span className="font-semibold">⌘K / Ctrl+K</span> for Command Palette.
          </div>
        </div>
      </div>
    </div>
  );
}
