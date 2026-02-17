import { headers } from "next/headers";

/**
 * Server-only helper.
 * Builds the correct origin in Vercel/prod and local dev.
 */
export async function getBaseUrl() {
  const h = await headers();

  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");

  // If we're in a request context (normal server render), use forwarded host.
  if (host) return `${proto}://${host}`;

  // Fallbacks (rare)
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return "http://localhost:3000";
}
