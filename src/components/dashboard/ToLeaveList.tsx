"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DeletedArchiveItem = {
  id: string;
  title: string;
  deleted_at: string;
  created_at?: string | null;
  completed_at?: string | null;
};

const DELETED_STORAGE_KEY = "freshware.toleave.deleted.v1";

async function jsonFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function loadDeletedArchive(): DeletedArchiveItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDeletedArchive(items: DeletedArchiveItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  } catch {}
}

export default function ToLeaveList() {
  const [items, setItems] = useState<Item[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [deletedArchive, setDeletedArchive] = useState<DeletedArchiveItem[]>([]);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [pulseDone, setPulseDone] = useState(false);
  const [floatingNote, setFloatingNote] = useState<string | null>(null);
  const floatTimerRef = useRef<number | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await jsonFetch("/api/to-leave");
      setItems(res?.items || []);
    } catch (e: any) {
      if (e?.message === "Unauthorized") {
        setErr("Your session expired. Refresh the page and try again.");
      } else {
        setErr(e?.message || "Failed to load To-Leave List.");
      }
    }
  }

  useEffect(() => {
    setDeletedArchive(loadDeletedArchive());
    load();
    return () => {
      if (floatTimerRef.current) window.clearTimeout(floatTimerRef.current);
    };
  }, []);

  function pushDeletedArchive(item: Item) {
    const next: DeletedArchiveItem[] = [
      {
        id: item.id,
        title: item.title,
        deleted_at: new Date().toISOString(),
        created_at: item.created_at,
        completed_at: item.completed_at,
      },
      ...deletedArchive,
    ];
    setDeletedArchive(next);
    saveDeletedArchive(next);
  }

  function triggerHandledAnimation(title: string) {
    setFloatingNote(`Moved "${title}" to Handled`);
    setPulseDone(true);

    if (floatTimerRef.current) window.clearTimeout(floatTimerRef.current);
    floatTimerRef.current = window.setTimeout(() => {
      setFloatingNote(null);
      setPulseDone(false);
    }, 1300);
  }

  async function addItem() {
    const title = value.trim();
    if (!title) return;

    setBusy(true);
    setErr(null);
    try {
      const res = await jsonFetch("/api/to-leave", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      if (res?.item) {
        setItems((prev) => [res.item, ...prev]);
      }
      setValue("");
    } catch (e: any) {
      if (e?.message === "Unauthorized") {
        setErr("Your session expired. Refresh the page and try again.");
      } else {
        setErr(e?.message || "Failed to add item.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(id: string, completed: boolean) {
    setErr(null);
    const prev = items;
    const item = items.find((x) => x.id === id);

    if (!item) return;

    if (completed) {
      setAnimatingId(id);
      window.setTimeout(() => {
        setItems((list) =>
          list.map((x) =>
            x.id === id
              ? { ...x, completed: true, completed_at: new Date().toISOString() }
              : x
          )
        );
        triggerHandledAnimation(item.title);
      }, 320);
    } else {
      setItems((list) =>
        list.map((x) =>
          x.id === id ? { ...x, completed: false, completed_at: null } : x
        )
      );
    }

    try {
      const res = await jsonFetch(`/api/to-leave/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });

      if (res?.item) {
        setItems((list) => list.map((x) => (x.id === id ? res.item : x)));
      }
    } catch (e: any) {
      setItems(prev);
      if (e?.message === "Unauthorized") {
        setErr("Your session expired. Refresh the page and try again.");
      } else {
        setErr(e?.message || "Failed to mark task completed.");
      }
      console.error("To-Leave toggle error:", e);
    } finally {
      window.setTimeout(() => setAnimatingId((current) => (current === id ? null : current)), 500);
    }
  }

  async function removeItem(id: string) {
    const target = items.find((x) => x.id === id);
    const prev = items;
    setItems((list) => list.filter((item) => item.id !== id));

    if (target) pushDeletedArchive(target);

    try {
      await jsonFetch(`/api/to-leave/${id}`, { method: "DELETE" });
    } catch (e: any) {
      setItems(prev);
      if (target) {
        const restored = loadDeletedArchive().filter((x) => x.id !== target.id);
        setDeletedArchive(restored);
        saveDeletedArchive(restored);
      }
      if (e?.message === "Unauthorized") {
        setErr("Your session expired. Refresh the page and try again.");
      } else {
        setErr(e?.message || "Failed to delete item.");
      }
    }
  }

  const active = useMemo(() => items.filter((i) => !i.completed), [items]);
  const done = useMemo(() => items.filter((i) => i.completed), [items]);
  const progress = items.length ? Math.round((done.length / items.length) * 100) : 0;

  return (
    <div className="relative rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">CEO standing list</div>
          <div className="text-2xl font-semibold tracking-tight">To-Leave List</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Capture it fast. Hit enter. Knock it out. Cross it off.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowArchive(true)}
            className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            View Archive
          </button>

          <div className="min-w-[140px] rounded-2xl border p-3 text-right">
            <div className="text-xs text-muted-foreground">Completion</div>
            <div className="text-2xl font-semibold">{progress}%</div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-gray-900 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {floatingNote ? (
        <div className="pointer-events-none absolute right-4 top-24 z-20 animate-[fadeInOut_1.3s_ease-in-out] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-lg">
          {floatingNote}
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Type a task and press Enter..."
          className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={busy || !value.trim()}
          className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          Add
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Still on your plate</div>
            <div className="text-xs text-muted-foreground">{active.length}</div>
          </div>

          <div className="mt-4 space-y-2">
            {active.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border p-3 transition hover:bg-gray-50"
              >
                {animatingId === item.id ? (
                  <div className="pointer-events-none absolute left-11 right-4 top-1/2 h-[2px] -translate-y-1/2 origin-left animate-[strikeAcross_.32s_ease-out_forwards] bg-gray-900" />
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => toggleItem(item.id, e.target.checked)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Created: {fmtDateTime(item.created_at)}
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-xl border px-3 py-1 text-xs font-semibold opacity-70 hover:bg-white hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {!active.length ? (
              <div className="text-sm text-muted-foreground">
                Nothing pending. That’s a CEO win.
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 transition-all duration-500 ${
            pulseDone ? "scale-[1.01] shadow-[0_0_22px_rgba(16,185,129,0.18)]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Handled</div>
            <div className="text-xs text-muted-foreground">{done.length}</div>
          </div>

          <div className="mt-4 space-y-2">
            {done.map((item) => (
              <div
                key={item.id}
                className="group flex items-start justify-between gap-3 rounded-2xl border bg-gray-50 p-3"
              >
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => toggleItem(item.id, e.target.checked)}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-muted-foreground line-through">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Created: {fmtDateTime(item.created_at)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Done: {fmtDateTime(item.completed_at)}
                    </div>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-xl border px-3 py-1 text-xs font-semibold opacity-70 hover:bg-white hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}

            {!done.length ? (
              <div className="text-sm text-muted-foreground">
                Completed items will show up here.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showArchive ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="max-h-[88vh] w-full overflow-hidden rounded-t-3xl border bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b p-4 sm:p-5">
              <div>
                <div className="text-lg font-semibold">To-Leave Archive</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Completed and deleted history.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowArchive(false)}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <div className="border-b p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="text-sm font-semibold">Completed Tasks</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  All tasks currently marked handled.
                </div>

                <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {done.map((item) => (
                    <div key={item.id} className="rounded-2xl border bg-gray-50 p-3">
                      <div className="text-sm font-medium line-through text-muted-foreground">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Created: {fmtDateTime(item.created_at)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Done: {fmtDateTime(item.completed_at)}
                      </div>
                    </div>
                  ))}

                  {!done.length ? (
                    <div className="text-sm text-muted-foreground">No completed tasks yet.</div>
                  ) : null}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="text-sm font-semibold">Deleted Tasks</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Deleted history stored on this device for now.
                </div>

                <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {deletedArchive.map((item) => (
                    <div key={`${item.id}-${item.deleted_at}`} className="rounded-2xl border bg-gray-50 p-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Created: {fmtDateTime(item.created_at || null)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Completed: {fmtDateTime(item.completed_at || null)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Deleted: {fmtDateTime(item.deleted_at)}
                      </div>
                    </div>
                  ))}

                  {!deletedArchive.length ? (
                    <div className="text-sm text-muted-foreground">No deleted tasks yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes strikeAcross {
          from {
            transform: translateY(-50%) scaleX(0);
            opacity: 0.35;
          }
          to {
            transform: translateY(-50%) scaleX(1);
            opacity: 1;
          }
        }

        @keyframes fadeInOut {
          0% {
            transform: translateY(6px);
            opacity: 0;
          }
          14% {
            transform: translateY(0);
            opacity: 1;
          }
          86% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-10px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}