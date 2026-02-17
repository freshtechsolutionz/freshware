import Link from "next/link";

export const runtime = "nodejs";

async function getData(stage?: string) {
  const url = stage
    ? `http://localhost:3000/api/ceo/pipeline?stage=${encodeURIComponent(stage)}`
    : `http://localhost:3000/api/ceo/pipeline`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res) return { error: "Unable to reach pipeline API" };
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return { error: "Non-JSON response from pipeline API" };
  return res.json();
}

function fmtMoney(n: number) {
  return "$" + new Intl.NumberFormat().format(Math.round(n));
}

export default async function PipelineReportPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const sp = await searchParams;
  const stage = sp?.stage || "";
  const data: any = await getData(stage || undefined);

  if (data?.error) return <div className="rounded-3xl border bg-white p-6 shadow-sm">{data.error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-gray-900">Pipeline Drilldown</div>
          <div className="mt-1 text-sm text-gray-600">
            Open pipeline: <span className="font-semibold">{fmtMoney(data.totals.openPipeline)}</span> · Open deals:{" "}
            <span className="font-semibold">{data.totals.openDeals}</span>
          </div>
          {data.stageFilter ? (
            <div className="mt-1 text-sm text-gray-600">
              Filter: <span className="font-semibold">{data.stageFilter}</span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/reports/pipeline" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Clear Filter
          </Link>
          <Link href="/dashboard" className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Back
          </Link>
        </div>
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Stages</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data.byStage || []).map((s: any) => (
            <Link
              key={s.stage}
              href={`/dashboard/reports/pipeline?stage=${encodeURIComponent(s.stage)}`}
              className="rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="text-base font-semibold text-gray-900">{s.stage}</div>
              <div className="mt-1 text-sm text-gray-600">{s.count} deals</div>
              <div className="mt-3 text-2xl font-semibold text-gray-900">{fmtMoney(s.amount)}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Deals</div>
        <div className="mt-4 space-y-2">
          {(data.deals || []).length ? (
            data.deals.slice(0, 50).map((d: any) => (
              <div key={d.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Stage: <span className="font-semibold">{d.stage}</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{fmtMoney(d.amount)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-600">No deals found.</div>
          )}
        </div>
      </section>
    </div>
  );
}
