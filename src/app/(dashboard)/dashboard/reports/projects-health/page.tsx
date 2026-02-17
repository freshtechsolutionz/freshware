import Link from "next/link";

export const runtime = "nodejs";

async function getData(health?: string) {
  const url = health
    ? `http://localhost:3000/api/ceo/projects-health?health=${encodeURIComponent(health)}`
    : `http://localhost:3000/api/ceo/projects-health`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res) return { error: "Unable to reach projects health API" };
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return { error: "Non-JSON response from projects health API" };
  return res.json();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default async function ProjectHealthPage({ searchParams }: { searchParams: Promise<{ health?: string }> }) {
  const sp = await searchParams;
  const health = sp?.health || "";
  const data: any = await getData(health || undefined);

  if (data?.error) return <div className="rounded-3xl border bg-white p-6 shadow-sm">{data.error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-gray-900">Project Health Heatmap</div>
          <div className="mt-1 text-sm text-gray-600">
            Active projects: <span className="font-semibold">{data.activeCount}</span>
          </div>
          {data.healthFilter ? (
            <div className="mt-1 text-sm text-gray-600">
              Filter: <span className="font-semibold">{data.healthFilter}</span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/reports/projects-health" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Clear Filter
          </Link>
          <Link href="/dashboard" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Back
          </Link>
        </div>
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Health Buckets</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data.buckets || []).map((b: any) => (
            <Link
              key={b.health}
              href={`/dashboard/reports/projects-health?health=${encodeURIComponent(b.health)}`}
              className="rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="text-base font-semibold text-gray-900">{b.health}</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{b.count}</div>
              <div className="mt-1 text-sm text-gray-600">active projects</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Projects</div>
        <div className="mt-4 space-y-2">
          {(data.projects || []).length ? (
            data.projects.slice(0, 50).map((p: any) => (
              <div key={p.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Health: <span className="font-semibold">{p.health}</span> · Status:{" "}
                      <span className="font-semibold">{p.status || "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Start: <span className="font-semibold">{fmtDate(p.start_date)}</span> · Due:{" "}
                      <span className="font-semibold">{fmtDate(p.due_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-600">No projects found for this filter.</div>
          )}
        </div>
      </section>
    </div>
  );
}
