"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Task = {
  task_id: string;
  opportunity_id: string | null;
  title: string | null;
};

type Props = {
  role: string;
  tasks: Task[];
};

export default function TasksTable({ role, tasks }: Props) {
  const [search, setSearch] = useState("");

  const canCreate = ["CEO", "ADMIN", "SALES"].includes(role);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks || []).filter((t) => {
      if (!q) return true;
      const title = (t.title || "").toLowerCase();
      const opp = (t.opportunity_id || "").toLowerCase();
      return title.includes(q) || opp.includes(q);
    });
  }, [tasks, search]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or opportunity id…"
            className="min-w-[260px] rounded-lg border px-3 py-2 text-sm"
          />

          <button
            onClick={() => setSearch("")}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            type="button"
          >
            Reset
          </button>

          {canCreate && (
            <Link
              href="/dashboard/tasks/new"
              className="rounded-lg border bg-background px-3 py-2 text-sm font-medium"
            >
              + New Task
            </Link>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{rows.length}</span> of{" "}
          <span className="font-medium">{tasks.length}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/30">
                <Th>Task</Th>
                <Th>Opportunity</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((t) => (
                <tr key={t.task_id} className="border-t">
                  <Td>
                    <div className="font-semibold">{t.title || "(No title)"}</div>
                    <div className="text-xs text-muted-foreground">{t.task_id}</div>
                  </Td>
                  <Td>
                    {t.opportunity_id ? (
                      <Link
                        href={`/dashboard/opportunities/${t.opportunity_id}`}
                        className="underline"
                      >
                        {t.opportunity_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Link href={`/dashboard/tasks/${t.task_id}`} className="underline">
                      View / Edit
                    </Link>
                  </Td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <Td colSpan={3}>
                    <div className="p-4">
                      <div className="font-semibold">No tasks found</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Try clearing search or create a new task.
                      </div>
                      {canCreate && (
                        <div className="mt-3">
                          <Link href="/dashboard/tasks/new" className="underline">
                            + Create task
                          </Link>
                        </div>
                      )}
                    </div>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className="whitespace-nowrap px-3 py-3 align-top">
      {children}
    </td>
  );
}
