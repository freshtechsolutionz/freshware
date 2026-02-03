"use client";

function money(n: number) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export default function CeoAdminKpiCards({
  kpis,
  meetings,
  visitors,
}: {
  kpis: {
    prospects_open: number;
    active_projects: number;
    open_pipeline_amount: number;
    opportunities_total: number;
    projects_total: number;
  };
  meetings: {
    meetings_today: number;
    meetings_7d: number;
    meetings_30d: number;
  };
  visitors?: {
    visitors_today: number;
    visitors_7d: number;
    visitors_30d: number;
  } | null;
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ margin: "0 0 10px" }}>CEO / Admin Insights</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 12 }}>
          <div style={{ opacity: 0.7 }}>Site Visitors</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {visitors ? visitors.visitors_today : "Connect"}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            7d: {visitors ? visitors.visitors_7d : "—"} • 30d:{" "}
            {visitors ? visitors.visitors_30d : "—"}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
            (We’ll connect GA4/Plausible next)
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 12 }}>
          <div style={{ opacity: 0.7 }}>Meetings Booked (YCBM)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            Today: {meetings.meetings_today}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            7d: {meetings.meetings_7d} • 30d: {meetings.meetings_30d}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 12 }}>
          <div style={{ opacity: 0.7 }}>Active Projects</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{kpis.active_projects}</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Total projects: {kpis.projects_total}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 12 }}>
          <div style={{ opacity: 0.7 }}>Prospects (Open)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{kpis.prospects_open}</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Open pipeline: {money(kpis.open_pipeline_amount)}
          </div>
        </div>
      </div>
    </section>
  );
}
