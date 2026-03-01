"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeetingRow } from "./page";

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
}

export default function MeetingsClient({
  range,
  rangeLabel,
  meetings,
}: {
  range: string;
  rangeLabel: string;
  meetings: MeetingRow[];
}) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Manual create form
  const [mName, setMName] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mWhen, setMWhen] = useState(""); // local datetime input
  const [mLink, setMLink] = useState("");
  const [mSummary, setMSummary] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (status !== "all" && (m.status || "").toLowerCase() !== status) return false;
      if (source !== "all" && (m.source || "").toLowerCase() !== source) return false;

      if (!q) return true;

      const hay = [
        m.contact_name,
        m.contact_email,
        m.description,
        m.meeting_summary,
        m.meeting_link,
        m.external_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [meetings, search, status, source]);

  async function createManualMeeting() {
    setErr(null);

    const when = mWhen.trim();
    if (!when) {
      setErr("Please pick a date/time.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/meetings/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contact_name: mName.trim() || null,
          contact_email: mEmail.trim().toLowerCase() || null,
          phone: mPhone.trim() || null,
          scheduled_at_local: when,
          meeting_link: mLink.trim() || null,
          meeting_summary: mSummary.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(json?.error || `Failed (${res.status})`);
        setCreating(false);
        return;
      }

      // reset
      setMName("");
      setMEmail("");
      setMPhone("");
      setMWhen("");
      setMLink("");
      setMSummary("");

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to create meeting.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Meetings</div>
          <div className="text-sm text-gray-600">Scheduled calls, demos, and follow-ups.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { r: "", label: "All" },
            { r: "today", label: "Today" },
            { r: "week", label: "This week" },
            { r: "7", label: "Last 7 days" },
            { r: "30", label: "Last 30 days" },
          ].map((x) => (
            <Link
              key={x.label}
              href={`/dashboard/meetings${x.r ? `?range=${x.r}` : ""}`}
              className={`rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 ${
                (range || "") === x.r ? "ring-1 ring-black/10" : ""
              }`}
            >
              {x.label}
            </Link>
          ))}

          <button
            className="rounded-2xl border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={() => setCreating((v) => !v)}
          >
            + New Meeting
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border bg-background p-3 text-sm">
          <b className="text-red-600">Error:</b> {err}
        </div>
      ) : null}

      {creating ? (
        <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="font-semibold">Create Manual Meeting</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border p-2"
              placeholder="Contact name"
              value={mName}
              onChange={(e) => setMName(e.target.value)}
            />
            <input
              className="rounded-xl border p-2"
              placeholder="Contact email"
              value={mEmail}
              onChange={(e) => setMEmail(e.target.value)}
            />
            <input
              className="rounded-xl border p-2"
              placeholder="Phone"
              value={mPhone}
              onChange={(e) => setMPhone(e.target.value)}
            />
            <input
              className="rounded-xl border p-2"
              type="datetime-local"
              value={mWhen}
              onChange={(e) => setMWhen(e.target.value)}
            />
            <input
              className="rounded-xl border p-2 md:col-span-2"
              placeholder="Meeting link (Zoom/Google Meet/etc)"
              value={mLink}
              onChange={(e) => setMLink(e.target.value)}
            />
            <textarea
              className="rounded-xl border p-2 md:col-span-2"
              placeholder="Meeting Summary (what this meeting is about)"
              rows={3}
              value={mSummary}
              onChange={(e) => setMSummary(e.target.value)}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              className="rounded-2xl border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={createManualMeeting}
              disabled={false}
            >
              Save
            </button>
            <button
              className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            Showing: <span className="font-semibold text-gray-900">{rangeLabel}</span> ·{" "}
            <span className="font-semibold text-gray-900">{filtered.length}</span> meetings
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-xl border p-2 text-sm"
              placeholder="Search (name/email/summary/link)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="rounded-xl border p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All status</option>
              <option value="scheduled">scheduled</option>
              <option value="canceled">canceled</option>
              <option value="completed">completed</option>
            </select>
            <select className="rounded-xl border p-2 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              <option value="youcanbookme">youcanbookme</option>
              <option value="manual">manual</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border bg-white">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3 font-semibold">When</th>
                <th className="p-3 font-semibold">Contact</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Source</th>
                <th className="p-3 font-semibold">Summary</th>
                <th className="p-3 font-semibold">Link</th>
                <th className="p-3 font-semibold">Deal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/dashboard/meetings/${m.id}`} className="underline underline-offset-2 hover:opacity-80">
                      {fmtWhen(m.scheduled_at || m.start_at)}
                    </Link>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold">{m.contact_name || "—"}</div>
                    <div className="text-xs text-gray-600">{m.contact_email || "—"}</div>
                  </td>

                  <td className="p-3">{m.status || "—"}</td>
                  <td className="p-3">{m.source || "—"}</td>

                  <td className="p-3">
                    <div className="line-clamp-2">{m.meeting_summary || m.description || "—"}</div>
                  </td>

                  <td className="p-3">
                    {m.meeting_link ? (
                      <a className="underline" href={m.meeting_link} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="p-3">
                    {m.opportunity_id ? (
                      <Link
                        className="underline"
                        href={`/dashboard/opportunities/${m.opportunity_id}/meetings`}
                      >
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}

              {!filtered.length ? (
                <tr className="border-t">
                  <td className="p-4 text-gray-600" colSpan={7}>
                    No meetings found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Tip: Click a meeting date/time to open details, add notes, and see the summary + link.
        </div>
      </div>
    </>
  );
}