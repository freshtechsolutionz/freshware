"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeetingRow } from "./page";

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
}

function toggle(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
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
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // multi-select filters (requested)
  const [statuses, setStatuses] = useState<string[]>([]); // [] = all
  const [sources, setSources] = useState<string[]>([]); // [] = all

  // Manual create form
  const [mName, setMName] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mWhen, setMWhen] = useState(""); // local datetime input
  const [mLink, setMLink] = useState("");
  const [mSummary, setMSummary] = useState("");

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    (meetings || []).forEach((m) => {
      const s = (m.status || "").toLowerCase().trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [meetings]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    (meetings || []).forEach((m) => {
      const s = (m.source || "").toLowerCase().trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [meetings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (meetings || []).filter((m) => {
      const st = (m.status || "").toLowerCase();
      const src = (m.source || "").toLowerCase();

      if (statuses.length && !statuses.includes(st)) return false;
      if (sources.length && !sources.includes(src)) return false;

      if (!q) return true;

      const hay = [
        m.contact_name,
        m.contact_email,
        m.description,
        m.meeting_summary,
        m.notes,
        m.meeting_link,
        m.external_id,
        m.event_type,
        m.booking_page,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [meetings, search, statuses, sources]);

  async function createManualMeeting() {
    setErr(null);

    const when = mWhen.trim();
    if (!when) {
      setErr("Please pick a date/time.");
      return;
    }

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
        return;
      }

      // reset
      setMName("");
      setMEmail("");
      setMPhone("");
      setMWhen("");
      setMLink("");
      setMSummary("");
      setCreating(false);

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to create meeting.");
    }
  }

  return (
    <div className="pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
            type="button"
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

      {/* Manual Create */}
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

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="rounded-2xl border bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={createManualMeeting}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="mt-4 rounded-2xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-600">
            Showing: <span className="font-semibold text-gray-900">{rangeLabel}</span> ·{" "}
            <span className="font-semibold text-gray-900">{filtered.length}</span> meetings
          </div>

          <input
            className="w-full rounded-xl border p-2 text-sm md:w-[360px]"
            placeholder="Search (name/email/summary/link)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-3">
            <div className="text-sm font-semibold">Status</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableStatuses.length ? (
                availableStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatuses((cur) => toggle(cur, s))}
                    className={[
                      "rounded-full border px-3 py-1 text-sm",
                      statuses.includes(s) ? "bg-black text-white" : "bg-white",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                ))
              ) : (
                <div className="text-sm text-gray-500">No status values found.</div>
              )}

              {statuses.length ? (
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-sm text-gray-700"
                  onClick={() => setStatuses([])}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-3">
            <div className="text-sm font-semibold">Source</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableSources.length ? (
                availableSources.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSources((cur) => toggle(cur, s))}
                    className={[
                      "rounded-full border px-3 py-1 text-sm",
                      sources.includes(s) ? "bg-black text-white" : "bg-white",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                ))
              ) : (
                <div className="text-sm text-gray-500">No source values found.</div>
              )}

              {sources.length ? (
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-sm text-gray-700"
                  onClick={() => setSources([])}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* MOBILE: cards */}
        <div className="mt-4 space-y-3 md:hidden">
          {filtered.map((m) => {
            const when = fmtWhen(m.scheduled_at || m.start_at);
            const subtitle = m.meeting_summary || m.description || "—";
            return (
              <div key={m.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/meetings/${m.id}`}
                      className="block truncate text-sm font-semibold underline underline-offset-2"
                    >
                      {when}
                    </Link>
                    <div className="mt-1 truncate text-base font-semibold">
                      {m.contact_name || "—"}
                    </div>
                    <div className="truncate text-sm text-gray-600">{m.contact_email || "—"}</div>
                  </div>

                  <div className="shrink-0 text-right text-xs text-gray-600">
                    <div className="rounded-full border px-2 py-1">{m.status || "—"}</div>
                    <div className="mt-2 rounded-full border px-2 py-1">{m.source || "—"}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-800">
                  <div className="line-clamp-3">{subtitle}</div>
                </div>

                <div className="mt-3 flex gap-3">
                  <Link
                    href={`/dashboard/meetings/${m.id}`}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  >
                    Open
                  </Link>

                  {m.meeting_link ? (
                    <a
                      className="rounded-xl border px-3 py-2 text-sm font-semibold"
                      href={m.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Link
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}

          {!filtered.length ? (
            <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
              No meetings found for this filter.
            </div>
          ) : null}
        </div>

        {/* DESKTOP: table */}
        <div className="mt-4 hidden overflow-auto rounded-2xl border bg-white md:block">
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
                      <Link className="underline" href={`/dashboard/opportunities/${m.opportunity_id}/meetings`}>
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
    </div>
  );
}