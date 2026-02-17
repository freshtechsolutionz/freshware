import Link from "next/link";

export const runtime = "nodejs";

async function getData() {
  const res = await fetch("http://localhost:3000/api/ceo/overdue", { cache: "no-store" }).catch(() => null);
  if (!res) return { error: "Unable to reach /api/ceo/overdue" };
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return { error: "Non-JSON response from overdue API" };
  return res.json();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default async function OverdueReportPage() {
  const data: any = await getData();
  if (data?.error) {
    return <div className="rounded-3xl border bg-white p-6 shadow-sm">{data.error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-gray-900">Overdue Tasks</div>
          <div className="mt-1 text-sm text-gray-600">
            Overdue: <span className="font-semibold">{data.counts.overdue}</span> · Blocked:{" "}
            <span className="font-semibold">{data.counts.blocked}</span>
          </div>
        </div>
        <Link href="/dashboard" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
          Back to Dashboard
        </Link>
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Overdue</div>
        <div className="mt-4 space-y-2">
          {data.overdue.length ? (
            data.overdue.map((t: any) => (
              <div key={t.task_id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{t.title}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Due: <span className="font-semibold">{fmtDate(t.due_at)}</span> · Status:{" "}
                      <span className="font-semibold">{t.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Assignee: <span className="font-semibold">{t.assignee_name || "Unassigned"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-600">No overdue tasks.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Blocked</div>
        <div className="mt-4 space-y-2">
          {data.blocked.length ? (
            data.blocked.map((t: any) => (
              <div key={t.task_id} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold text-gray-900">{t.title}</div>
                <div className="mt-1 text-xs text-gray-600">
                  Status: <span className="font-semibold">{t.status}</span> · Assignee:{" "}
                  <span className="font-semibold">{t.assignee_name || "Unassigned"}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-600">No blocked tasks.</div>
          )}
        </div>
      </section>
    </div>
  );
}
