import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function runReport(propertyId: string, startDate: string, endDate: string) {
  const clientEmail = requireEnv("freshware-ga4-reader@freshware-analytics.iam.gserviceaccount.com");
  const privateKey = requireEnv("da88c193c2d7bb26c40cdc40a830d1810186cda6").replace(/\\n/g, "\n");

  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });

  const token = await auth.getAccessToken();
  if (!token) throw new Error("Failed to get Google access token");

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  const body = {
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: "activeUsers" }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API error ${res.status}: ${text}`);
  }

  const json: any = await res.json();
  const valueStr =
    json?.rows?.[0]?.metricValues?.[0]?.value ??
    json?.totals?.[0]?.metricValues?.[0]?.value ??
    "0";

  const value = Number(valueStr || 0);
  return Number.isFinite(value) ? value : 0;
}

export async function GET() {
  try {
    const propertyId = requireEnv("GA4_PROPERTY_ID");

    const [today, last7, last30] = await Promise.all([
      runReport(propertyId, "today", "today"),
      runReport(propertyId, "7daysAgo", "today"),
      runReport(propertyId, "30daysAgo", "today"),
    ]);

    return NextResponse.json({
      visitors_today: today,
      visitors_7d: last7,
      visitors_30d: last30,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Analytics error" },
      { status: 500 }
    );
  }
}
