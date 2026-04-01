import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  query: string;
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
  if (!value) return null;
  return value;
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
  ];

  return blocked.some((bad) => domain === bad || domain.endsWith(`.${bad}`));
}

function cleanCompanyName(title: string, domain: string) {
  const base = stripTags(title)
    .replace(/\s*\|\s*.*$/g, "")
    .replace(/\s*-\s*.*$/g, "")
    .trim();

  if (base && base.length >= 3) return base;

  const host = domain.replace(/^www\./, "");
  const root = host.split(".")[0] || "Unnamed Company";
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
    )
  ).slice(0, 8);
}

function extractPhones(text: string) {
  const matches = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
  return Array.from(new Set(matches.map((v) => v.trim()))).slice(0, 8);
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
    const text = stripHtml(html).slice(0, 12000);

    return { ok: true, status: res.status, html, text };
  } catch {
    return { ok: false, status: 0, html: "", text: "" };
  }
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
    lcText.includes("app") ||
    lcText.includes("mobile app") ||
    lcText.includes("download on the app store") ||
    lcText.includes("google play");

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

  if (
    text.includes("outdated") ||
    text.includes("website") ||
    text.includes("mobile") ||
    text.includes("contact us")
  ) {
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
    ai_summary: `${input.companyName} appears to be a real prospect sourced from live web search and scored based on website and search-result signals.`,
    ai_reasoning: `Freshware sourced this company from live public web search results and applied heuristic scoring using visible website and snippet signals.`,
    outreach_angle: `Lead with business value tied to ${need.toLowerCase()}.`,
    first_touch_message: `Hi, I came across ${input.companyName} and noticed what looks like an opportunity around ${need.toLowerCase()}. My team helps businesses improve growth, efficiency, and customer experience through practical ${titleCaseService(recommended)} support. Would you be open to a quick conversation to see if there is a fit?`,
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
  const industries = splitList(input.industries || input.benchmarkCompany?.industry || "").slice(0, 4);
  const primaryIndustry = industries[0] || "small business";
  const size = safeText(input.companySizes);
  const service = titleCaseService(input.serviceFocus || "consulting");

  const queries = new Set<string>();

  if (input.mode === "similar_to_company" && input.benchmarkCompany?.name) {
    queries.add(`${primaryIndustry} company ${geo}`);
    queries.add(`${primaryIndustry} business ${geo}`);
    queries.add(`${input.benchmarkCompany.name} competitors ${geo}`);
  } else if (input.mode === "likely_needs") {
    queries.add(`${primaryIndustry} ${geo} business`);
    queries.add(`${primaryIndustry} ${geo} company website`);
    queries.add(`${primaryIndustry} ${geo} appointment booking company`);
  } else if (input.mode === "specific_company") {
    queries.add(`${primaryIndustry} ${geo}`);
  } else {
    queries.add(`${primaryIndustry} ${geo} company`);
    queries.add(`${primaryIndustry} ${geo} business`);
    queries.add(`${primaryIndustry} ${geo} services`);
  }

  if (size) {
    queries.add(`${primaryIndustry} ${geo} ${size} company`);
  }

  if (service) {
    queries.add(`${primaryIndustry} ${geo}`);
  }

  return Array.from(queries).slice(0, 6);
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildFallbackQueries(input);
  }

  try {
    const prompt = `
You are building public web search queries to find real business websites for B2B sales prospecting.

Return STRICT JSON only:
{ "queries": ["q1", "q2", "q3", "q4", "q5"] }

Rules:
- Queries must try to find real company websites, not articles.
- Prefer local businesses and organizations.
- Do not include site:linkedin.com, site:facebook.com, or other social sites.
- Keep each query short and practical.

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

    if (!res.ok) {
      return buildFallbackQueries(input);
    }

    const data = await res.json().catch(() => null);
    const outputText =
      typeof data?.output_text === "string" && data.output_text.trim()
        ? data.output_text.trim()
        : "";

    if (!outputText) {
      return buildFallbackQueries(input);
    }

    const parsed = JSON.parse(outputText);
    const queries = Array.isArray(parsed?.queries)
      ? parsed.queries.map((q: unknown) => safeText(q)).filter(Boolean)
      : [];

    return queries.length ? queries.slice(0, 6) : buildFallbackQueries(input);
  } catch {
    return buildFallbackQueries(input);
  }
}

async function searchDuckDuckGo(query: string, perQueryLimit: number): Promise<SearchResult[]> {
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
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) && results.length < perQueryLimit) {
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
      if (!domain) continue;
      if (isExcludedDomain(domain)) continue;

      results.push({
        title,
        url: href,
        snippet,
        domain,
        query,
      });
    }

    return results;
  } catch {
    return [];
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
    queries.map((query: string) =>
      searchDuckDuckGo(query, Math.max(6, Math.ceil(input.limit / 2)))
    )
  );
  const flat = allResults.flat();

  const deduped = new Map<string, SearchResult>();
  for (const result of flat) {
    if (!deduped.has(result.domain)) {
      deduped.set(result.domain, result);
    }
  }

  return Array.from(deduped.values()).slice(0, input.limit);
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
        const fetched = row.website ? await fetchWebsiteText(row.website) : null;
        const signals = fetched ? detectSignals(fetched.html, fetched.text, row.website || "") : null;
        const emails = fetched ? extractEmails(`${fetched.html}\n${fetched.text}`) : [];
        const phones = fetched ? extractPhones(`${fetched.html}\n${fetched.text}`) : [];

        const ai = buildHeuristicLead({
          companyName: row.company_name,
          website: row.website,
          serviceFocus,
          snippet: row.raw,
          websiteText: fetched?.text || "",
        });

        rows.push({
          account_id: accountId,
          company_name: row.company_name,
          website: row.website,
          contact_email: row.email || emails[0] || null,
          contact_phone: row.phone || phones[0] || null,
          discovered_emails: emails,
          discovered_phones: phones,
          industry: toNullable(industries),
          city: toNullable(geography),
          source: "business_lists",
          source_type: "directory",
          source_label: sourceLabelInput || "Business List Import",
          source_url: sourceUrlInput || row.website || null,
          source_snapshot: row.raw,
          generation_mode: mode,
          detected_need: ai.detected_need,
          recommended_service_line: ai.recommended_service_line,
          fit_score: ai.fit_score,
          need_score: ai.need_score,
          urgency_score: ai.urgency_score,
          access_score: ai.access_score,
          total_score: ai.total_score,
          ai_score: ai.total_score,
          ai_summary: ai.ai_summary,
          ai_reasoning: ai.ai_reasoning,
          outreach_angle: ai.outreach_angle,
          first_touch_message: ai.first_touch_message,
          website_analysis: signals
            ? {
                digital_maturity: signals.likelyOutdated ? "low" : "medium",
                fetched_from_directory_seed: true,
                detected_signals: signals,
              }
            : null,
          website_analyzed_at: fetched?.ok ? new Date().toISOString() : null,
          website_analysis_model: fetched?.ok ? "heuristic_live_web" : null,
          raw_import_row: row.raw,
          created_by: user.id,
          status: "new",
          tags: ["business_list", "real_company_data"],
          parse_confidence: 0.85,
        });
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

      const fetched = website ? await fetchWebsiteText(website) : null;
      const signals = fetched ? detectSignals(fetched.html, fetched.text, website || "") : null;
      const emails = fetched ? extractEmails(`${fetched.html}\n${fetched.text}`) : [];
      const phones = fetched ? extractPhones(`${fetched.html}\n${fetched.text}`) : [];

      const ai = buildHeuristicLead({
        companyName: companyName || website || "Unnamed Company",
        website,
        serviceFocus,
        snippet: notes,
        websiteText: fetched?.text || "",
      });

      rows.push({
        account_id: accountId,
        company_name: companyName || website || "Unnamed Company",
        website,
        contact_email: emails[0] || null,
        contact_phone: phones[0] || null,
        discovered_emails: emails,
        discovered_phones: phones,
        industry: toNullable(industries),
        city: toNullable(geography),
        source: "specific_company",
        source_type: "web_search",
        source_label: "Specific Company Analysis",
        source_url: website || null,
        source_snapshot: [companyName, website, notes].filter(Boolean).join(" | "),
        generation_mode: mode,
        detected_need: ai.detected_need,
        recommended_service_line: ai.recommended_service_line,
        fit_score: ai.fit_score,
        need_score: ai.need_score,
        urgency_score: ai.urgency_score,
        access_score: ai.access_score,
        total_score: ai.total_score,
        ai_score: ai.total_score,
        ai_summary: ai.ai_summary,
        ai_reasoning: ai.ai_reasoning,
        outreach_angle: ai.outreach_angle,
        first_touch_message: ai.first_touch_message,
        website_analysis: signals
          ? {
              digital_maturity: signals.likelyOutdated ? "low" : "medium",
              detected_signals: signals,
            }
          : null,
        website_analyzed_at: fetched?.ok ? new Date().toISOString() : null,
        website_analysis_model: fetched?.ok ? "heuristic_live_web" : null,
        raw_import_row: null,
        created_by: user.id,
        status: "new",
        tags: ["specific_company", "real_company_data"],
        parse_confidence: 1,
      });
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
              "No real companies were found from live public web search. Try a narrower industry + geography combination, or use Business Lists / CSV import.",
          },
          { status: 404 }
        );
      }

      for (const result of realResults) {
        const fetched = await fetchWebsiteText(result.url);
        const signals = detectSignals(fetched.html, fetched.text, result.url);
        const emails = extractEmails(`${fetched.html}\n${fetched.text}\n${result.snippet}`);
        const phones = extractPhones(`${fetched.html}\n${fetched.text}\n${result.snippet}`);

        const companyName = cleanCompanyName(result.title, result.domain);

        const ai = buildHeuristicLead({
          companyName,
          website: result.url,
          serviceFocus,
          snippet: result.snippet,
          websiteText: fetched.text,
        });

        rows.push({
          account_id: accountId,
          company_name: companyName,
          website: result.url,
          contact_email: emails[0] || null,
          contact_phone: phones[0] || null,
          discovered_emails: emails,
          discovered_phones: phones,
          industry: toNullable(industries),
          city: toNullable(geography),
          source: "live_web_search",
          source_type: "web_search",
          source_label:
            mode === "similar_to_company"
              ? "Live Lookalike Search"
              : mode === "likely_needs"
              ? "Live Likely Needs Search"
              : "Live Ideal Customer Search",
          source_url: result.url,
          source_snapshot: `Query: ${result.query} | Title: ${result.title} | Snippet: ${result.snippet}`,
          generation_mode: mode,
          detected_need: ai.detected_need,
          recommended_service_line: ai.recommended_service_line,
          fit_score: ai.fit_score,
          need_score: ai.need_score,
          urgency_score: ai.urgency_score,
          access_score: ai.access_score,
          total_score: ai.total_score,
          ai_score: ai.total_score,
          ai_summary: ai.ai_summary,
          ai_reasoning: ai.ai_reasoning,
          outreach_angle: ai.outreach_angle,
          first_touch_message: ai.first_touch_message,
          website_analysis: {
            digital_maturity: signals.likelyOutdated ? "low" : "medium",
            detected_signals: signals,
            search_query: result.query,
            search_snippet: result.snippet,
            domain: result.domain,
          },
          website_analyzed_at: fetched.ok ? new Date().toISOString() : null,
          website_analysis_model: "heuristic_live_web",
          raw_import_row: null,
          created_by: user.id,
          status: "new",
          tags: ["real_company_data", "live_web_search", mode],
          parse_confidence: 0.88,
        });
      }
    }

    const deduped = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const key =
        normalizeWebsite(row.website || "") ||
        `${String(row.company_name || "").toLowerCase()}::${String(row.city || "").toLowerCase()}`;
      if (!deduped.has(key)) {
        deduped.set(key, row);
      }
    }

    const finalRows = Array.from(deduped.values()).slice(0, limit);

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
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/generate error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}