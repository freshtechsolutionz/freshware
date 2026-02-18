import Link from "next/link";

export const runtime = "nodejs";

export default function AnalyticsReportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Analytics</div>
          <div className="mt-1 text-sm text-zinc-600">Site traffic + lead conversions (GA4 connection pending).</div>
        </div>
        <Link href="/dashboard" className="fw-btn text-sm">
          Back
        </Link>
      </div>

      <div className="fw-card-strong p-7">
        <div className="text-sm font-semibold text-zinc-900">Not connected yet</div>
        <div className="mt-2 text-sm text-zinc-700">
          You still get value from this page today: it becomes the single home for growth metrics once GA4 is connected.
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-zinc-900">Visitors</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">—</div>
            <div className="mt-2 text-sm text-zinc-600">Today</div>
          </div>

          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-zinc-900">Conversions</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">—</div>
            <div className="mt-2 text-sm text-zinc-600">Lead submits / bookings</div>
          </div>

          <div className="fw-card p-6">
            <div className="text-sm font-semibold text-zinc-900">Top channels</div>
            <div className="mt-2 text-sm text-zinc-600">Organic · Paid · Direct · Social</div>
            <div className="mt-3 text-xs text-zinc-500">Will populate once GA4 is wired.</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-5 text-sm text-zinc-700">
          <div className="text-xs font-semibold text-zinc-700">Next step</div>
          <div className="mt-1">
            When you’re ready, we’ll add a GA4 integration and store daily snapshots in a table like <span className="font-semibold">analytics_daily</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
