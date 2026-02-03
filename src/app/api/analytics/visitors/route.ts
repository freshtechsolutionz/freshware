import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // no caching while testing

function safeBool(v: any) {
  return v ? true : false;
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function runReport(propertyId: string, startDate: string, endDate: string) {
  const clientEmail = requireEnv("GOOGLE_CLIENT_EMAIL");
  const privateKey = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });

  const token = await auth.getAccessToken();
  if (!token) throw new Error("Failed to get Google access token");

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  // Using activeUsers as “visitors”
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

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`GA4 API error ${res.status}: ${text}`);
  }

  const json: any = JSON.parse(text);

  const valueStr =
    json?.rows?.[0]?.metricValues?.[0]?.value ??
    json?.totals?.[0]?.metricValues?.[0]?.value ??
    "0";

  const value = Number(valueStr || 0);
  return Number.isFinite(value) ? value : 0;
}

export async function GET() {
  try {
    // Debug: confirm env vars are visible (without leaking secrets)
    const hasProperty = safeBool(process.env.GA4_PROPERTY_ID);
    const hasEmail = safeBool(process.env.GOOGLE_CLIENT_EMAIL);
    const hasKey = safeBool(process.env.GOOGLE_PRIVATE_KEY);

    const propertyId = requireEnv("GA4_PROPERTY_ID");

    const [today, last7, last30] = await Promise.all([
      runReport(propertyId, "today", "today"),
      runReport(propertyId, "7daysAgo", "today"),
      runReport(propertyId, "30daysAgo", "today"),
    ]);

    return NextResponse.json({
      ok: true,
      env_seen: { GA4_PROPERTY_ID: hasProperty, GOOGLE_CLIENT_EMAIL: hasEmail, GOOGLE_PRIVATE_KEY: hasKey },
      visitors_today: today,
      visitors_7d: last7,
      visitors_30d: last30,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Analytics error",
        env_seen: {
          GA4_PROPERTY_ID: !!process.env.GA4_PROPERTY_ID,
          GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
          GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
        },
      },
      { status: 500 }
    );
  }
}
