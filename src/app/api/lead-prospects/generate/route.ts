import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  query: string;
  provider: string;
};

type BenchmarkCompany = {
  name?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
} | null;

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value: unknown) {
  const v = safeText(value);
  return v || null;
}

function normalizeWebsite(raw: string | null | undefined) {
  const value = safeText(raw);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes(".")) return `https://${value}`;
  return null;
}

function normalizeEmail(raw: string | null | undefined) {
  const value = safeText(raw);
  if (!value || !value.includes("@")) return null;
  return value.toLowerCase();
}

function normalizePhone(raw: string | null | undefined) {
  const value = safeText(raw);
  return value || null;
}

function titleCaseService(service: string | null | undefined) {
  const value = String(service || "").trim();
  if (!value) return "Consulting";
  return value
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function htmlDecode(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&#47;/g, "/");
}

function stripTags(input: string) {
  return htmlDecode(input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isExcludedDomain(domain: string) {
  const blocked = [
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "youtube.com",
    "tiktok.com",
    "yelp.com",
    "yellowpages.com",
    "mapquest.com",
    "bbb.org",
    "angi.com",
    "manta.com",
    "chamberofcommerce.com",
    "opencorporates.com",
    "zoominfo.com",
    "rocketreach.co",
    "indeed.com",
    "glassdoor.com",
    "duckduckgo.com",
    "google.com",
    "bing.com",
    "apple.com",
    "play.google.com",
  ];

  return blocked.some((bad) => domain === bad || domain.endsWith(`.${bad}`));
}

function cleanCompanyName(title: string, domain: string) {
  const base = stripTags(title)
    .replace(/\s*\|\s*.*$/g, "")
    .replace(/\s*-\s*.*$/g, "")
    .replace(/\bhome\b/i, "")
    .trim();

  if (base && base.length >= 3) return base;

  const root = domain.replace(/^www\./, "").split(".")[0] || "Unnamed Company";
  return root
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractEmails(text: string) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(
    new Set(
      matches
        .map((v) => normalizeEmail(v))
        .filter((v): v is string => Boolean(v))
        .filter((v) => !v.includes("example.com"))
        .filter((v) => !v.includes("domain.com"))
        .filter((v) => !v.endsWith("@email.com"))
    )
  ).slice(0, 12);
}

function extractPhones(text: string) {
  const matches = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
  return Array.from(new Set(matches.map((v) => v.trim()))).slice(0, 12);
}

function parseJsonFromResponse(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function parseBusinessListBlock(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 1200);

  const grouped: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    const looksLikeNewBusiness =
      !buffer.length ||
      /^https?:\/\//i.test(line) ||
      (line.length < 90 &&
        !line.includes("@") &&
        !/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(line));

    if (looksLikeNewBusiness && buffer.length) {
      grouped.push(buffer.join(" | "));
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length) grouped.push(buffer.join(" | "));

  return grouped
    .map((entry) => {
      const websiteMatch = entry.match(
        /https?:\/\/[^\s|]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s|]*)?/i
      );
      const emailMatch = entry.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const phoneMatch = entry.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const parts = entry.split("|").map((v) => v.trim()).filter(Boolean);

      const companyName =
        parts.find(
          (p) =>
            p !== websiteMatch?.[0] &&
            p !== emailMatch?.[0] &&
            p !== phoneMatch?.[0] &&
            p.length > 2
        ) || "Unnamed Lead";

      return {
        company_name: companyName,
        website: normalizeWebsite(websiteMatch?.[0] || null),
        email: normalizeEmail(emailMatch?.[0] || null),
        phone: normalizePhone(phoneMatch?.[0] || null),
        raw: entry,
      };
    })
    .filter((row) => row.company_name);
}

async function fetchWebsiteText(website: string) {
  try {
    const res = await fetch(website, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "FreshwareCompanyDiscovery/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, status: res.status, html: "", text: "" };
    }

    const html = await res.text();
    const text = stripHtml(html).slice(0, 16000);

    return { ok: true, status: res.status, html, text };
  } catch {
    return { ok: false, status: 0, html: "", text: "" };
  }
}

function extractContactLinks(html: string, baseWebsite: string) {
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html))) {
    const href = match[1] || "";
    const h = href.toLowerCase();

    if (
      h.includes("contact") ||
      h.includes("about") ||
      h.includes("team") ||
      h.includes("staff") ||
      h.includes("leadership") ||
      h.includes("location")
    ) {
      try {
        links.push(new URL(href, baseWebsite).toString());
      } catch {
        // ignore
      }
    }
  }

  const base = new URL(baseWebsite);
  const guesses = ["/contact", "/contact-us", "/about", "/about-us", "/team", "/staff"].map(
    (path) => `${base.origin}${path}`
  );

  return Array.from(new Set([...links, ...guesses])).slice(0, 5);
}

async function fetchContactIntel(website: string, homeHtml: string, homeText: string) {
  const links = extractContactLinks(homeHtml, website);
  let combinedHtml = homeHtml;
  let combinedText = homeText;
  let contactPageUrl: string | null = links[0] || null;

  for (const link of links) {
    const fetched = await fetchWebsiteText(link);
    if (fetched.ok) {
      contactPageUrl = link;
      combinedHtml += `\n${fetched.html}`;
      combinedText += `\n${fetched.text}`;
    }
  }

  return {
    contactPageUrl,
    emails: extractEmails(`${combinedHtml}\n${combinedText}`),
    phones: extractPhones(`${combinedHtml}\n${combinedText}`),
    combinedText,
    combinedHtml,
  };
}

function detectSignals(html: string, text: string, website: string) {
  const lcHtml = html.toLowerCase();
  const lcText = text.toLowerCase();

  const hasHttps = /^https:\/\//i.test(website);
  const hasContactForm =
    lcHtml.includes("<form") ||
    lcText.includes("contact us") ||
    lcText.includes("get in touch") ||
    lcText.includes("book now");

  const hasBooking =
    lcText.includes("schedule") ||
    lcText.includes("appointment") ||
    lcText.includes("book now") ||
    lcText.includes("consultation");

  const hasPortal =
    lcText.includes("portal") ||
    lcText.includes("dashboard") ||
    lcText.includes("login");

  const hasAppLanguage =
    lcText.includes("download on the app store") ||
    lcText.includes("google play") ||
    lcText.includes("mobile app") ||
    lcText.includes("our app");

  const hasEcommerce =
    lcText.includes("shop") ||
    lcText.includes("cart") ||
    lcText.includes("checkout") ||
    lcText.includes("order online");

  const likelyOutdated =
    !lcHtml.includes("viewport") ||
    (!hasContactForm && !hasBooking && !hasPortal && !hasEcommerce);

  return {
    hasHttps,
    hasContactForm,
    hasBooking,
    hasPortal,
    hasAppLanguage,
    hasEcommerce,
    likelyOutdated,
  };
}

async function searchBrave(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
      query
    )}&count=${Math.min(20, limit)}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items = Array.isArray(json?.web?.results) ? json.web.results : [];

    return items
      .map((item: any) => {
        const url = String(item?.url || "");
        return {
          title: stripTags(String(item?.title || "")),
          url,
          snippet: stripTags(String(item?.description || "")),
          domain: getDomain(url),
          query,
          provider: "brave",
        };
      })
      .filter((r: SearchResult) => r.url && r.domain && !isExcludedDomain(r.domain))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchSerpApi(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
      query
    )}&num=${Math.min(20, limit)}&api_key=${key}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const json = await res.json();
    const items = Array.isArray(json?.organic_results) ? json.organic_results : [];

    return items
      .map((item: any) => {
        const url = String(item?.link || "");
        return {
          title: stripTags(String(item?.title || "")),
          url,
          snippet: stripTags(String(item?.snippet || "")),
          domain: getDomain(url),
          query,
          provider: "serpapi",
        };
      })
      .filter((r: SearchResult) => r.url && r.domain && !isExcludedDomain(r.domain))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchBing(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.BING_SEARCH_API_KEY;
  if (!key) return [];

  try {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(
      query
    )}&count=${Math.min(20, limit)}&responseFilter=Webpages`;

    const res = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
      },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items = Array.isArray(json?.webPages?.value) ? json.webPages.value : [];

    return items
      .map((item: any) => {
        const url = String(item?.url || "");
        return {
          title: stripTags(String(item?.name || "")),
          url,
          snippet: stripTags(String(item?.snippet || "")),
          domain: getDomain(url),
          query,
          provider: "bing",
        };
      })
      .filter((r: SearchResult) => r.url && r.domain && !isExcludedDomain(r.domain))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchGoogleCse(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(
      query
    )}&num=${Math.min(10, limit)}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    return items
      .map((item: any) => {
        const url = String(item?.link || "");
        return {
          title: stripTags(String(item?.title || "")),
          url,
          snippet: stripTags(String(item?.snippet || "")),
          domain: getDomain(url),
          query,
          provider: "google_cse",
        };
      })
      .filter((r: SearchResult) => r.url && r.domain && !isExcludedDomain(r.domain))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FreshwareCompanyDiscovery/1.0",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results: SearchResult[] = [];

    const regex =
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) && results.length < limit) {
      let href = htmlDecode(match[1] || "").trim();
      const title = stripTags(match[2] || "");
      const snippet = stripTags(match[3] || "");

      if (href.startsWith("//")) href = `https:${href}`;

      try {
        const maybe = new URL(href);
        const uddg = maybe.searchParams.get("uddg");
        if (uddg) href = decodeURIComponent(uddg);
      } catch {
        // ignore
      }

      const domain = getDomain(href);
      if (!domain || isExcludedDomain(domain)) continue;

      results.push({
        title,
        url: href,
        snippet,
        domain,
        query,
        provider: "duckduckgo",
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function runSearchProviders(query: string, limit: number) {
  const providerLimit = Math.max(5, Math.min(20, limit));

  const brave = await searchBrave(query, providerLimit);
  if (brave.length) return brave;

  const serp = await searchSerpApi(query, providerLimit);
  if (serp.length) return serp;

  const bing = await searchBing(query, providerLimit);
  if (bing.length) return bing;

  const google = await searchGoogleCse(query, providerLimit);
  if (google.length) return google;

  return searchDuckDuckGo(query, providerLimit);
}

async function searchAppStores(companyName: string) {
  const clean = safeText(companyName);
  if (!clean) {
    return {
      apple_app_store_url: null,
      google_play_url: null,
      has_ios_app: false,
      has_android_app: false,
    };
  }

  const appleQuery = `${clean} app site:apps.apple.com`;
  const playQuery = `${clean} app site:play.google.com/store/apps`;

  const [appleResults, playResults] = await Promise.all([
    runSearchProviders(appleQuery, 3),
    runSearchProviders(playQuery, 3),
  ]);

  const apple = appleResults.find((r) => r.domain.includes("apps.apple.com"));
  const play = playResults.find((r) => r.url.includes("play.google.com/store/apps"));

  return {
    apple_app_store_url: apple?.url || null,
    google_play_url: play?.url || null,
    has_ios_app: Boolean(apple?.url),
    has_android_app: Boolean(play?.url),
  };
}

function buildFallbackQueries(input: {
  mode: string;
  geography: string;
  industries: string;
  serviceFocus: string;
  buyerTitles: string;
  companySizes: string;
  notes: string;
  benchmarkCompany?: BenchmarkCompany;
}) {
  const geo = safeText(input.geography) || "Houston";
  const industries = splitList(input.industries || input.benchmarkCompany?.industry || "").slice(0, 5);
  const primaryIndustry = industries[0] || "small business";
  const size = safeText(input.companySizes);
  const titles = safeText(input.buyerTitles);
  const queries = new Set<string>();

  if (input.mode === "similar_to_company" && input.benchmarkCompany?.name) {
    queries.add(`${primaryIndustry} companies ${geo}`);
    queries.add(`${primaryIndustry} businesses ${geo}`);
    queries.add(`${input.benchmarkCompany.name} competitors ${geo}`);
    queries.add(`best ${primaryIndustry} companies ${geo}`);
  } else if (input.mode === "likely_needs") {
    queries.add(`${primaryIndustry} ${geo} book appointment`);
    queries.add(`${primaryIndustry} ${geo} contact us`);
    queries.add(`${primaryIndustry} ${geo} services`);
    queries.add(`${primaryIndustry} ${geo} online scheduling`);
  } else {
    queries.add(`${primaryIndustry} companies ${geo}`);
    queries.add(`${primaryIndustry} businesses ${geo}`);
    queries.add(`${primaryIndustry} services ${geo}`);
    queries.add(`${primaryIndustry} organization ${geo}`);
  }

  for (const industry of industries.slice(1)) {
    queries.add(`${industry} companies ${geo}`);
    queries.add(`${industry} businesses ${geo}`);
  }

  if (size) queries.add(`${size} ${primaryIndustry} companies ${geo}`);
  if (titles) queries.add(`${primaryIndustry} ${titles} ${geo}`);

  return Array.from(queries).slice(0, 10);
}

async function buildQueriesWithAI(input: {
  mode: string;
  geography: string;
  industries: string;
  serviceFocus: string;
  buyerTitles: string;
  companySizes: string;
  notes: string;
  benchmarkCompany?: BenchmarkCompany;
}) {
  const fallback = buildFallbackQueries(input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const prompt = `
You are building public web search queries to find real business websites for B2B sales prospecting.

Return STRICT JSON only:
{ "queries": ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] }

Rules:
- Find real company websites.
- Prefer company homepages, contact pages, directories only if needed.
- Avoid social media, job boards, review sites, and articles.
- Use the geography and industry.
- Keep each query practical.

Input:
${JSON.stringify(input, null, 2)}
    `.trim();

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_LEAD_QUERY_MODEL || "gpt-5-mini",
        input: prompt,
      }),
    });

    if (!res.ok) return fallback;

    const data = await res.json().catch(() => null);
    const outputText = data ? parseJsonFromResponse(data) : "";
    if (!outputText) return fallback;

    const parsed = JSON.parse(outputText);
    const queries = Array.isArray(parsed?.queries)
      ? parsed.queries.map((q: unknown) => safeText(q)).filter(Boolean)
      : [];

    return Array.from(new Set([...queries, ...fallback])).slice(0, 12);
  } catch {
    return fallback;
  }
}

async function discoverRealCompanies(input: {
  mode: string;
  geography: string;
  industries: string;
  serviceFocus: string;
  buyerTitles: string;
  companySizes: string;
  notes: string;
  benchmarkCompany?: BenchmarkCompany;
  limit: number;
}) {
  const queries = await buildQueriesWithAI(input);
  const allResults = await Promise.all(
    queries.map((query) => runSearchProviders(query, Math.max(8, Math.ceil(input.limit / 2))))
  );

  const deduped = new Map<string, SearchResult>();
  for (const result of allResults.flat()) {
    if (!result.domain) continue;
    if (isExcludedDomain(result.domain)) continue;
    if (!deduped.has(result.domain)) deduped.set(result.domain, result);
  }

  return Array.from(deduped.values()).slice(0, input.limit);
}

function buildHeuristicLead(input: {
  companyName: string;
  website: string | null;
  serviceFocus: string;
  snippet: string;
  websiteText: string;
}) {
  const service = input.serviceFocus || "consulting";
  const text = `${input.snippet} ${input.websiteText}`.toLowerCase();

  let recommended = service || "consulting";
  let need = "Technology strategy and growth support";
  let fit = 62;
  let needScore = 60;
  let urgency = 55;
  let access = input.website ? 68 : 35;

  if (text.includes("book") || text.includes("schedule") || text.includes("appointment")) {
    recommended = "software";
    need = "Booking workflow optimization and internal process automation";
    fit += 8;
    needScore += 12;
  }

  if (text.includes("portal") || text.includes("login") || text.includes("dashboard")) {
    recommended = "support";
    need = "Platform support, optimization, or expansion";
    fit += 8;
    needScore += 10;
  }

  if (text.includes("mobile app") || text.includes("google play") || text.includes("app store")) {
    recommended = "mobile_app";
    need = "Mobile app optimization, modernization, or feature expansion";
    fit += 12;
    needScore += 10;
  }

  if (text.includes("website") || text.includes("contact us")) {
    if (recommended === service || !recommended) recommended = "website";
    need = "Website modernization and stronger conversion flow";
    urgency += 10;
  }

  if (text.includes("manual") || text.includes("paperwork") || text.includes("spreadsheet")) {
    recommended = "ai";
    need = "Workflow automation and operational efficiency";
    urgency += 8;
    needScore += 8;
  }

  const total = Math.min(
    100,
    Math.round((Number(fit) + Number(needScore) + Number(urgency) + Number(access)) / 4)
  );

  return {
    detected_need: need,
    recommended_service_line: recommended,
    fit_score: Math.min(100, fit),
    need_score: Math.min(100, needScore),
    urgency_score: Math.min(100, urgency),
    access_score: Math.min(100, access),
    total_score: total,
    ai_summary: `${input.companyName} appears to be a real prospect sourced from live search and scored based on website, contact, app-store, and search-result signals.`,
    ai_reasoning: `Freshware sourced this company through configured search providers and applied heuristic scoring using visible website and snippet signals.`,
    outreach_angle: `Lead with business value tied to ${need.toLowerCase()}.`,
    first_touch_message: `Hi, I came across ${input.companyName} and noticed what looks like an opportunity around ${need.toLowerCase()}. My team helps businesses improve growth, efficiency, and customer experience through practical ${titleCaseService(recommended)} support. Would you be open to a quick conversation to see if there is a fit?`,
  };
}

async function buildLeadRow(input: {
  accountId: string;
  userId: string;
  companyName: string;
  website: string | null;
  serviceFocus: string;
  snippet: string;
  websiteText: string;
  homeHtml: string;
  homeText: string;
  source: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceSnapshot: string | null;
  generationMode: string;
  industries: string;
  geography: string;
  rawImportRow?: string | null;
  parseConfidence?: number;
}) {
  const website = input.website ? normalizeWebsite(input.website) : null;
  const contactIntel = website
    ? await fetchContactIntel(website, input.homeHtml, input.homeText)
    : { emails: [], phones: [], contactPageUrl: null, combinedText: input.websiteText, combinedHtml: "" };

  const signals = website ? detectSignals(contactIntel.combinedHtml, contactIntel.combinedText, website) : null;
  const appStore = await searchAppStores(input.companyName);

  const ai = buildHeuristicLead({
    companyName: input.companyName,
    website,
    serviceFocus: input.serviceFocus,
    snippet: input.snippet,
    websiteText: contactIntel.combinedText || input.websiteText,
  });

  return {
    account_id: input.accountId,
    company_name: input.companyName,
    website,
    contact_email: contactIntel.emails[0] || null,
    contact_phone: contactIntel.phones[0] || null,
    discovered_emails: contactIntel.emails,
    discovered_phones: contactIntel.phones,
    contact_page_url: contactIntel.contactPageUrl,
    industry: toNullable(input.industries),
    city: toNullable(input.geography),
    source: input.source,
    source_type: input.sourceType,
    source_label: input.sourceLabel,
    source_url: input.sourceUrl || website,
    source_snapshot: input.sourceSnapshot,
    generation_mode: input.generationMode,
    detected_need: ai.detected_need,
    recommended_service_line: ai.recommended_service_line,
    fit_score: ai.fit_score,
    need_score: ai.need_score,
    urgency_score: ai.urgency_score,
    access_score: Math.min(100, ai.access_score + (contactIntel.emails.length || contactIntel.phones.length ? 10 : 0)),
    total_score: ai.total_score,
    ai_score: ai.total_score,
    ai_summary: ai.ai_summary,
    ai_reasoning: ai.ai_reasoning,
    outreach_angle: ai.outreach_angle,
    first_touch_message: ai.first_touch_message,
    website_analysis: {
      digital_maturity: signals?.likelyOutdated ? "low" : "medium",
      detected_signals: signals,
      search_provider: input.sourceType,
      contact_page_url: contactIntel.contactPageUrl,
      discovered_emails: contactIntel.emails,
      discovered_phones: contactIntel.phones,
      app_store: appStore,
    },
    website_analyzed_at: website ? new Date().toISOString() : null,
    website_analysis_model: website ? "multi_search_heuristic_live_web" : null,
    raw_import_row: input.rawImportRow || null,
    created_by: input.userId,
    status: "new",
    tags: ["real_company_data", input.generationMode, input.sourceType],
    parse_confidence: input.parseConfidence ?? 0.9,
    apple_app_store_url: appStore.apple_app_store_url,
    google_play_url: appStore.google_play_url,
    has_ios_app: appStore.has_ios_app,
    has_android_app: appStore.has_android_app,
    app_store_checked_at: new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || !profile.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));

    const mode = safeText(body?.mode || "ideal_customer");
    const geography = safeText(body?.geography);
    const industries = safeText(body?.industries);
    const serviceFocus = safeText(body?.serviceFocus) || "consulting";
    const notes = safeText(body?.notes);
    const companySizes = safeText(body?.companySizes);
    const buyerTitles = safeText(body?.buyerTitles);
    const sourceLabelInput = safeText(body?.sourceLabel);
    const sourceUrlInput = safeText(body?.sourceUrl);
    const candidateInput = safeText(body?.candidateInput);
    const limit = Math.max(1, Math.min(100, Number(body?.limit || 25)));
    const accountId = profile.account_id;

    let benchmarkCompany: BenchmarkCompany = null;
    const lookalikeCompanyId = safeText(body?.lookalikeCompanyId);

    if (mode === "similar_to_company" && lookalikeCompanyId) {
      const { data } = await supabase
        .from("companies")
        .select("id, name, industry, city, state")
        .eq("id", lookalikeCompanyId)
        .eq("account_id", accountId)
        .maybeSingle();

      benchmarkCompany = (data as BenchmarkCompany) || null;
    }

    const rows: Record<string, any>[] = [];

    if (mode === "business_lists") {
      const parsedRows = parseBusinessListBlock(candidateInput);

      if (!parsedRows.length) {
        return NextResponse.json(
          { error: "Add at least one business listing block." },
          { status: 400 }
        );
      }

      for (const row of parsedRows.slice(0, limit)) {
        const website = row.website;
        const fetched = website ? await fetchWebsiteText(website) : { ok: false, html: "", text: "" };

        const leadRow = await buildLeadRow({
          accountId,
          userId: user.id,
          companyName: row.company_name,
          website,
          serviceFocus,
          snippet: row.raw,
          websiteText: fetched.text || "",
          homeHtml: fetched.html || "",
          homeText: fetched.text || "",
          source: "business_lists",
          sourceType: "directory",
          sourceLabel: sourceLabelInput || "Business List Import",
          sourceUrl: sourceUrlInput || website,
          sourceSnapshot: row.raw,
          generationMode: mode,
          industries,
          geography,
          rawImportRow: row.raw,
          parseConfidence: 0.85,
        });

        leadRow.contact_email = row.email || leadRow.contact_email;
        leadRow.contact_phone = row.phone || leadRow.contact_phone;
        rows.push(leadRow);
      }
    } else if (mode === "specific_company") {
      const companyName = safeText(body?.companyName);
      const website = normalizeWebsite(body?.website);

      if (!companyName && !website) {
        return NextResponse.json(
          { error: "Enter an exact company name or website." },
          { status: 400 }
        );
      }

      const fetched = website ? await fetchWebsiteText(website) : { ok: false, html: "", text: "" };

      rows.push(
        await buildLeadRow({
          accountId,
          userId: user.id,
          companyName: companyName || website || "Unnamed Company",
          website,
          serviceFocus,
          snippet: notes,
          websiteText: fetched.text || "",
          homeHtml: fetched.html || "",
          homeText: fetched.text || "",
          source: "specific_company",
          sourceType: "web_search",
          sourceLabel: "Specific Company Analysis",
          sourceUrl: website,
          sourceSnapshot: [companyName, website, notes].filter(Boolean).join(" | "),
          generationMode: mode,
          industries,
          geography,
          rawImportRow: null,
          parseConfidence: 1,
        })
      );
    } else {
      const realResults = await discoverRealCompanies({
        mode,
        geography,
        industries,
        serviceFocus,
        buyerTitles,
        companySizes,
        notes,
        benchmarkCompany,
        limit,
      });

      if (!realResults.length) {
        return NextResponse.json(
          {
            error:
              "No real companies were found. Check that at least one search API key is active in Vercel, then try a narrower industry and geography.",
          },
          { status: 404 }
        );
      }

      for (const result of realResults) {
        const fetched = await fetchWebsiteText(result.url);
        const companyName = cleanCompanyName(result.title, result.domain);

        rows.push(
          await buildLeadRow({
            accountId,
            userId: user.id,
            companyName,
            website: result.url,
            serviceFocus,
            snippet: result.snippet,
            websiteText: fetched.text || "",
            homeHtml: fetched.html || "",
            homeText: fetched.text || "",
            source: "live_web_search",
            sourceType: result.provider || "web_search",
            sourceLabel:
              mode === "similar_to_company"
                ? "Live Lookalike Search"
                : mode === "likely_needs"
                ? "Live Likely Needs Search"
                : "Live Ideal Customer Search",
            sourceUrl: result.url,
            sourceSnapshot: `Provider: ${result.provider} | Query: ${result.query} | Title: ${result.title} | Snippet: ${result.snippet}`,
            generationMode: mode,
            industries,
            geography,
            rawImportRow: null,
            parseConfidence: 0.9,
          })
        );
      }
    }

    const deduped = new Map<string, Record<string, any>>();

    for (const row of rows) {
      const key =
        normalizeWebsite(row.website || "") ||
        `${String(row.company_name || "").toLowerCase()}::${String(row.city || "").toLowerCase()}`;

      if (!deduped.has(key)) deduped.set(key, row);
    }

    const finalRows = Array.from(deduped.values()).slice(0, limit);

    if (!finalRows.length) {
      return NextResponse.json(
        { error: "No valid lead rows were created from the search results." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("lead_prospects")
      .insert(finalRows)
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
      leads: data || [],
      source_mode: mode,
      real_data: true,
      search_stack: ["brave", "serpapi", "bing", "google_cse", "duckduckgo"],
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/generate error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}