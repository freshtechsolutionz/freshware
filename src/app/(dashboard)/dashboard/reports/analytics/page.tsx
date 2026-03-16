import Link from "next/link";

export const runtime = "nodejs";

async function getVisitors(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/analytics/visitors`, {
      cache: "no-store",
    });
    const json = await res.json();
    return {
      ok: res.ok && !!json?.ok,
      data: json,
    };
  } catch (e: any) {
    return {
      ok: false,
      data: { error: e?.message || "Failed to call analytics route." },
    };
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat().format(n);
}

export default async function AnalyticsReportPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const result = await getVisitors(baseUrl);
  const visitors = result.ok ? result.data : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Analytics</div>
          <div className="mt-1 text-sm text-zinc-600">
            Site traffic and growth visibility for Fresh Tech Solutionz.
          </div>
        </div>
        <Link href="/dashboard" className="fw-btn text-sm">
          Back
        </Link>
      </div>

      <div className="fw-card-strong p-7">
        <div className="text-sm font-semibold text-zinc-900">GA4 Traffic Snapshot</div>
        <div className="mt-2 text-sm text-zinc-700">
          This page reads your GA4 active users through the Freshware API route.
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-zinc-900">Visitors Today</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">
              {visitors ? fmt(visitors.visitors_today) : "—"}
            </div>
            <div className="mt-2 text-sm text-zinc-600">Today</div>
          </div>

          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-zinc-900">Visitors 7 Days</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">
              {visitors ? fmt(visitors.visitors_7d) : "—"}
            </div>
            <div className="mt-2 text-sm text-zinc-600">Rolling 7-day traffic</div>
          </div>

          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-zinc-900">Visitors 30 Days</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">
              {visitors ? fmt(visitors.visitors_30d) : "—"}
            </div>
            <div className="mt-2 text-sm text-zinc-600">Rolling 30-day traffic</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-zinc-700">
          <div className="text-xs font-semibold text-zinc-700">Data source</div>
          <div className="mt-1">
            {visitors
              ? "GA4 is connected through /api/analytics/visitors."
              : result.data?.error || "GA4 route did not return live data."}
          </div>

          {!visitors ? (
            <div className="mt-3 text-xs text-zinc-500">
              Env seen:{" "}
              GA4_PROPERTY_ID={String(!!result.data?.env_seen?.GA4_PROPERTY_ID)} |{" "}
              GOOGLE_CLIENT_EMAIL={String(!!result.data?.env_seen?.GOOGLE_CLIENT_EMAIL)} |{" "}
              GOOGLE_PRIVATE_KEY={String(!!result.data?.env_seen?.GOOGLE_PRIVATE_KEY)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}