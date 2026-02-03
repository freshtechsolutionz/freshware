"use client";

function money(n: number) {
  const num = Number(n || 0);
  return `$${num.toLocaleString()}`;
}

function num(n: number) {
  const v = Number(n || 0);
  return v.toLocaleString();
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
  visitors: {
    visitors_today: number;
    visitors_7d: number;
    visitors_30d: number;
  } | null;
}) {
  const tileStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: 16,
    borderRadius: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    minHeight: 110,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
    letterSpacing: 0.2,
    marginBottom: 6,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.1,
  };

  const subStyle: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 1.4,
  };

  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Executive Overview</h2>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Live metrics (GA4 + Freshware)
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {/* Visitors */}
        <div style={tileStyle}>
          <div style={labelStyle}>Site Visitors Today</div>
          <div style={valueStyle}>{visitors ? num(visitors.visitors_today) : "—"}</div>
          <div style={subStyle}>
            <div>
              <b>7 days:</b> {visitors ? num(visitors.visitors_7d) : "—"}{" "}
              <span style={{ opacity: 0.5 }}>•</span> <b>30 days:</b>{" "}
              {visitors ? num(visitors.visitors_30d) : "—"}
            </div>
            <div style={{ marginTop: 6, opacity: 0.6 }}>
              Daily active users (GA4 activeUsers)
            </div>
          </div>
        </div>

        {/* Meetings */}
        <div style={tileStyle}>
          <div style={labelStyle}>Meetings Booked (YCBM)</div>
          <div style={valueStyle}>{num(meetings.meetings_today)}</div>
          <div style={subStyle}>
            <div>
              <b>7d:</b> {num(meetings.meetings_7d)}{" "}
              <span style={{ opacity: 0.5 }}>•</span> <b>30d:</b>{" "}
              {num(meetings.meetings_30d)}
            </div>
            <div style={{ marginTop: 6, opacity: 0.6 }}>
              Pulled from ycbm_bookings
            </div>
          </div>
        </div>

        {/* Active Projects */}
        <div style={tileStyle}>
          <div style={labelStyle}>Active Projects</div>
          <div style={valueStyle}>{num(kpis.active_projects)}</div>
          <div style={subStyle}>
            <div>
              <b>Total:</b> {num(kpis.projects_total)}
            </div>
            <div style={{ marginTop: 6, opacity: 0.6 }}>
              Status not done/closed/completed/cancelled
            </div>
          </div>
        </div>

        {/* Prospects */}
        <div style={tileStyle}>
          <div style={labelStyle}>Prospects (Open)</div>
          <div style={valueStyle}>{num(kpis.prospects_open)}</div>
          <div style={subStyle}>
            <div>
              <b>Open pipeline:</b> {money(kpis.open_pipeline_amount)}
            </div>
            <div style={{ marginTop: 6, opacity: 0.6 }}>
              Opportunities not won/lost
            </div>
          </div>
        </div>
      </div>

      {/* Secondary row */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={tileStyle}>
          <div style={labelStyle}>Total Opportunities</div>
          <div style={valueStyle}>{num(kpis.opportunities_total)}</div>
          <div style={subStyle}>
            <div style={{ opacity: 0.6 }}>
              All opportunities (open + won + lost)
            </div>
          </div>
        </div>

        <div style={tileStyle}>
          <div style={labelStyle}>Data Notes</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>
            <div>
              • Visitors: <b>freshtechsolutionz.com</b> (GA4)
            </div>
            <div>
              • Meetings: <b>YouCanBookMe</b> (webhook → ycbm_bookings)
            </div>
            <div>
              • Pipeline/Projects: <b>Freshware DB</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
