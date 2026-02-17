import { cookies, headers } from "next/headers";
import { getBaseUrl } from "@/lib/baseUrl";

type Json = Record<string, any>;

export async function serverFetch(path: string, init?: RequestInit) {
  const baseUrl = await getBaseUrl();
  const cookieStore = await cookies();
  const h = await headers();

  const reqHeaders = new Headers(init?.headers);

  // Always forward cookies so API routes can authenticate the viewer.
  if (!reqHeaders.has("cookie")) {
    reqHeaders.set("cookie", cookieStore.toString());
  }

  // Helpful forwarded headers (not required but nice for debugging / consistency)
  const xfProto = h.get("x-forwarded-proto");
  const xfHost = h.get("x-forwarded-host");
  if (xfProto && !reqHeaders.has("x-forwarded-proto")) reqHeaders.set("x-forwarded-proto", xfProto);
  if (xfHost && !reqHeaders.has("x-forwarded-host")) reqHeaders.set("x-forwarded-host", xfHost);

  const url = new URL(path, baseUrl);

  const res = await fetch(url, {
    ...init,
    headers: reqHeaders,
    cache: "no-store",
  });

  return res;
}

export async function serverFetchJson<T = Json>(path: string, init?: RequestInit): Promise<T> {
  const res = await serverFetch(path, init);
  const data = await res.json().catch(() => ({} as T));
  if (!res.ok) {
    const msg = (data as any)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
