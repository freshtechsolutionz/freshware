"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

export type MeetingRow = {
  id: string;

  contact_name: string | null;
  contact_email: string | null;
  scheduled_at: string | null;

  booked_at: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string | null;

  status: string | null;
  source: string | null;

  booking_id: string | null;
  booking_ref: string | null;
  booking_page: string | null;
  event_type: string | null;

  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;

  description: string | null;
  raw: any | null;

  contact_id: string | null;
  owner_profile_id: string | null;
  opportunity_id: string | null;

  created_at: string | null;
};

function pickWhen(m: MeetingRow) {
  return m.start_at || m.scheduled_at || m.booked_at || m.created_at || null;
}

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
  } catch {
    return iso;
  }
}

function fmtDateOnly(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago" });
  } catch {
    return iso;
  }
}

function small(s: string | null | undefined) {
  return (s || "").trim() ? String(s) : "—";
}

function guessName(m: MeetingRow) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (m.contact_name) return m.contact_name;
  return "—";
}

function guessEmail(m: MeetingRow) {
  return m.email || m.contact_email || null;
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

export default function MeetingsClient({ meetings }: { meetings: MeetingRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const selected = useMemo(
    () => meetings.find((m) => m.id === openId) || null,
    [meetings, openId]
  );

  return (
    <div className="space-y-3">
      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {meetings.map((m) => {
          const when = pickWhen(m);
          const name = guessName(m);
          const email = guessEmail(m);
          return (
            <button
              key={m.id}
              onClick={() => setOpenId(m.id)}
              className="text-left rounded-2xl border bg-white p-4 hover:bg-gray-50"
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{name}</div>
                  <div className="mt-1 text-xs text-gray-600 break-words">{email || "—"}</div>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs font-semibold">
                  {small(m.status)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>
                  <div className="font-semibold text-gray-700">When</div>
                  <div>{fmtWhen(when)}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Type</div>
                  <div className="break-words">{small(m.event_type)}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Source</div>
                  <div className="break-words">{small(m.source)}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Phone</div>
                  <div className="break-words">{small(m.phone)}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-600">
                <span className="font-semibold text-gray-700">Notes:</span>{" "}
                {m.description ? truncate(m.description, 140) : "—"}
              </div>
            </button>
          );
        })}

        {!meetings.length ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
            No meetings found for this filter.
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-auto rounded-2xl border bg-white">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3 font-semibold">When</th>
              <th className="p-3 font-semibold">Contact</th>
              <th className="p-3 font-semibold">Email</th>
              <th className="p-3 font-semibold">Phone</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Event Type</th>
              <th className="p-3 font-semibold">Source</th>
              <th className="p-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => {
              const when = pickWhen(m);
              const name = guessName(m);
              const email = guessEmail(m);
              return (
                <tr
                  key={m.id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => setOpenId(m.id)}
                >
                  <td className="p-3 whitespace-nowrap">{fmtWhen(when)}</td>
                  <td className="p-3">
                    <div className="font-semibold text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500">{m.id}</div>
                  </td>
                  <td className="p-3">{email || "—"}</td>
                  <td className="p-3">{m.phone || "—"}</td>
                  <td className="p-3">{m.status || "—"}</td>
                  <td className="p-3">{m.event_type || "—"}</td>
                  <td className="p-3">{m.source || "—"}</td>
                  <td className="p-3">{m.description ? truncate(m.description, 140) : "—"}</td>
                </tr>
              );
            })}
            {!meetings.length ? (
              <tr className="border-t">
                <td className="p-4 text-gray-600" colSpan={8}>
                  No meetings found for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selected ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenId(null)}
            aria-label="Close"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-xl border-l">
            <div className="flex items-start justify-between gap-3 p-5 border-b">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-gray-900">Meeting Details</div>
                <div className="mt-1 text-sm text-gray-600 break-words">
                  {guessName(selected)} · {guessEmail(selected) || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-auto h-[calc(100%-72px)]">
              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">Schedule</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Start</div>
                    <div className="mt-1">{fmtWhen(selected.start_at || selected.scheduled_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">End</div>
                    <div className="mt-1">{fmtWhen(selected.end_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Timezone</div>
                    <div className="mt-1">{small(selected.timezone)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Booked</div>
                    <div className="mt-1">{fmtDateOnly(selected.booked_at)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">Booking Metadata</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Event Type</div>
                    <div className="mt-1 break-words">{small(selected.event_type)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Status</div>
                    <div className="mt-1">{small(selected.status)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Booking Ref</div>
                    <div className="mt-1 break-words">{small(selected.booking_ref)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Booking ID</div>
                    <div className="mt-1 break-words">{small(selected.booking_id)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-gray-600">Booking Page</div>
                    <div className="mt-1 break-words">
                      {selected.booking_page ? (
                        <a className="underline" href={selected.booking_page} target="_blank" rel="noreferrer">
                          {selected.booking_page}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Source</div>
                    <div className="mt-1 break-words">{small(selected.source)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">Contact</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Name</div>
                    <div className="mt-1 break-words">{guessName(selected)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Phone</div>
                    <div className="mt-1 break-words">{small(selected.phone)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-gray-600">Email</div>
                    <div className="mt-1 break-words">{guessEmail(selected) || "—"}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.contact_id ? (
                    <Link
                      className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                      href={`/dashboard/contacts/${selected.contact_id}`}
                    >
                      Open Contact
                    </Link>
                  ) : null}

                  {selected.opportunity_id ? (
                    <Link
                      className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                      href={`/dashboard/opportunities/${selected.opportunity_id}`}
                    >
                      Open Opportunity
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">Notes / Intake Answers</div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {selected.description || "—"}
                </div>
              </div>

              <details className="rounded-2xl border p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                  Raw payload (debug)
                </summary>
                <pre className="mt-3 text-xs overflow-auto rounded-xl bg-gray-50 p-3">
{JSON.stringify(selected.raw, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
