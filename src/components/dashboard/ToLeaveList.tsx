"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

async function jsonFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export default function ToLeaveList() {
  const [items, setItems] = useState<Item[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await jsonFetch("/api/to-leave");
      setItems(res?.items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load To-Leave List.");
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      setErr(e?.message || "Failed to add item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(id: string, completed: boolean) {
    setErr(null);
    const prev = items;
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...item, completed } : item))
    );

    try {
      const res = await jsonFetch(`/api/to-leave/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      if (res?.item) {
        setItems((list) => list.map((item) => (item.id === id ? res.item : item)));
      }
    } catch (e: any) {
      setItems(prev);
      setErr(e?.message || "Failed to mark task completed.");
      console.error("To-Leave toggle error:", e);
    }
  }

  async function removeItem(id: string) {
    const prev = items;
    setItems((list) => list.filter((item) => item.id !== id));
    try {
      await jsonFetch(`/api/to-leave/${id}`, { method: "DELETE" });
    } catch (e: any) {
      setItems(prev);
      setErr(e?.message || "Failed to delete item.");
    }
  }

  const active = useMemo(() => items.filter((i) => !i.completed), [items]);
  const done = useMemo(() => items.filter((i) => i.completed), [items]);
  const progress = items.length ? Math.round((done.length / items.length) * 100) : 0;

  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">CEO standing list</div>
          <div className="text-xl font-semibold">To-Leave List</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Capture it fast. Hit enter. Knock it out. Cross it off.
          </div>
        </div>

        <div className="min-w-[140px] rounded-2xl border p-3 text-right">
          <div className="text-xs text-muted-foreground">Completion</div>
          <div className="text-2xl font-semibold">{progress}%</div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-gray-900" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-5 flex gap-2">
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
                className="group flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:bg-gray-50"
              >
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => toggleItem(item.id, e.target.checked)}
                  />
                  <span className="truncate text-sm font-medium">{item.title}</span>
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

            {!active.length ? (
              <div className="text-sm text-muted-foreground">Nothing pending. That’s a CEO win.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Handled</div>
            <div className="text-xs text-muted-foreground">{done.length}</div>
          </div>

          <div className="mt-4 space-y-2">
            {done.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3"
              >
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => toggleItem(item.id, e.target.checked)}
                  />
                  <span className="truncate text-sm text-muted-foreground line-through">
                    {item.title}
                  </span>
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
              <div className="text-sm text-muted-foreground">Completed items will show up here.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}