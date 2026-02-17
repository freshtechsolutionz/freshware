"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
        "CEO Command Agent ready.\n\nUse the buttons for reports + drilldowns. Type below for quick commands like:\n- Create a task: Follow up with top 3 prospects (under Sales) due Friday 2pm CST\n- Summarize pipeline\n- What should I focus on today?",
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
      pushUser("Weekly CEO report");
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

  return (
    <div className="rounded-3xl bg-gradient-to-br from-black/20 via-black/10 to-black/0 p-[1px] shadow-sm">
      <div className="rounded-3xl border border-white/70 bg-white/75 backdrop-blur-md p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900">CEO Command Agent</div>
            <div className="mt-1 text-xs text-gray-600">Reports · Drilldowns · Actions</div>
          </div>
          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold">
            {busy ? "Working" : "Online"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={weeklyReport}
            disabled={busy}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
          >
            Weekly CEO Report
          </button>

          <Link
            href="/dashboard/reports/overdue"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center justify-center"
          >
            Overdue Tasks
          </Link>

          <Link
            href="/dashboard/reports/pipeline"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center justify-center"
          >
            Pipeline Drilldown
          </Link>

          <Link
            href="/dashboard/reports/projects-health"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center justify-center"
          >
            Project Health Heatmap
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white/85">
          <div className="max-h-[320px] overflow-auto p-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cls(
                  "rounded-2xl border border-black/10 p-3",
                  m.role === "user" ? "bg-black text-white border-black/20" : "bg-white text-gray-900"
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
                  if (e.key === "Enter" && canSend) sendAgent(input);
                }}
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none"
                placeholder="Ask CEO questions or issue a command..."
              />
              <button
                onClick={() => sendAgent(input)}
                disabled={!canSend}
                className={cls(
                  "h-10 rounded-xl px-4 text-sm font-semibold",
                  canSend ? "bg-black text-white hover:opacity-90" : "bg-black/20 text-white/70"
                )}
                type="button"
              >
                Send
              </button>
            </div>
            <div className="mt-2 text-[11px] text-gray-600">
              Reports are instant. Interactive drilldowns live in the dashboard pages.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
