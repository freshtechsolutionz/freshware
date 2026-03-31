import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractEmails(html: string, text: string) {
  const matches = [
    ...(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
    ...(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
  ];

  return uniq(
    matches
      .map((v) => normalizeEmail(v))
      .filter((v): v is string => Boolean(v))
      .filter((email) => !email.includes("example.com"))
  ).slice(0, 10);
}

function extractPhones(html: string, text: string) {
  const regex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = [...(html.match(regex) || []), ...(text.match(regex) || [])];
  return uniq(matches.map((v) => v.trim())).slice(0, 10);
}

function extractContactPageUrl(html: string, baseWebsite: string) {
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const candidates: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html))) {
    const href = match[1] || "";
    const hrefLower = href.toLowerCase();
    if (
      hrefLower.includes("contact") ||
      hrefLower.includes("about") ||
      hrefLower.includes("team") ||
      hrefLower.includes("staff")
    ) {
      candidates.push(href);
    }
  }

  const candidate = candidates[0];
  if (!candidate) return null;

  try {
    return new URL(candidate, baseWebsite).toString();
  } catch {
    return null;
  }
}

async function fetchWebsite(website: string) {
  try {
    const res = await fetch(website, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "FreshwareLeadWebsiteAnalyzer/1.0",
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

async function analyzeWithOpenAI(input: {
  companyName: string;
  website: string;
  websiteText: string;
  currentNeed: string | null;
  currentService: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_LEAD_WEBSITE_MODEL || "gpt-5-mini";

  const prompt = `
You are analyzing a lead's website for a software and digital transformation agency.

Return STRICT JSON only in this shape:
{
  "detected_need": "string or null",
  "recommended_service_line": "website | mobile_app | software | ai | support | consulting | null",
  "fit_score": 0,
  "need_score": 0,
  "urgency_score": 0,
  "access_score": 0,
  "total_score": 0,
  "ai_summary": "string",
  "ai_reasoning": "string",
  "outreach_angle": "string",
  "first_touch_message": "string",
  "website_analysis": {
    "digital_maturity": "low | medium | high | unknown",
    "signals": ["string"],
    "risks": ["string"],
    "opportunities": ["string"],
    "insights": ["string"]
  }
}

Lead:
${JSON.stringify(input, null, 2)}
  `.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data) return null;

  const text = parseJsonFromResponse(data);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fallbackAnalysis(input: {
  companyName: string;
  website: string;
  signals: ReturnType<typeof detectSignals>;
}) {
  const s = input.signals;

  let recommended = "consulting";
  let need = "Needs discovery";
  const opportunities: string[] = [];
  const risks: string[] = [];
  const insights: string[] = [];

  if (s.likelyOutdated) {
    recommended = "website";
    need = "Website modernization and stronger conversion flow";
    opportunities.push("Improve website conversion");
    opportunities.push("Modernize mobile and CTA experience");
    insights.push("The website appears to have weak modern conversion signals.");
  }

  if (s.hasBooking && !s.hasPortal) {
    recommended = "software";
    need = "Booking workflow optimization and internal process automation";
    opportunities.push("Automate intake and scheduling workflows");
    insights.push("There may be an operational workflow opportunity around scheduling.");
  }

  if (s.hasPortal) {
    recommended = "support";
    need = "Platform support, optimization, or expansion";
    opportunities.push("Improve existing platform support and visibility");
    insights.push("The business may already have a customer-facing system that could be optimized.");
  }

  if (s.hasAppLanguage) {
    opportunities.push("Potential app optimization or feature expansion");
    insights.push("There are signs of app-related digital maturity.");
  }

  if (!s.hasContactForm) {
    risks.push("Weak contact or conversion path");
  }

  if (!s.hasHttps) {
    risks.push("Security trust signal is weak");
  }

  return {
    detected_need: need,
    recommended_service_line: recommended,
    fit_score: 65,
    need_score: s.likelyOutdated ? 78 : 58,
    urgency_score: !s.hasContactForm ? 72 : 48,
    access_score: 45,
    total_score: s.likelyOutdated ? 72 : 55,
    ai_summary: `${input.companyName} shows digital signals that suggest opportunity for ${recommended === "website" ? "website improvement" : recommended}.`,
    ai_reasoning: `Website signals indicate ${need.toLowerCase()}.`,
    outreach_angle: `Lead with business outcomes tied to ${need.toLowerCase()}.`,
    first_touch_message: `Hi, I checked out ${input.companyName} and noticed a few opportunities to strengthen your digital experience and conversion flow. We help businesses improve systems like this without overcomplicating the process.`,
    website_analysis: {
      digital_maturity: s.likelyOutdated ? "low" : "medium",
      signals: [
        s.hasHttps ? "HTTPS enabled" : "HTTPS missing or unclear",
        s.hasContactForm ? "Contact path detected" : "Contact path weak",
        s.hasBooking ? "Booking flow detected" : "No booking flow detected",
        s.hasPortal ? "Portal/dashboard language detected" : "No portal language detected",
        s.hasAppLanguage ? "App language detected" : "No app language detected",
      ],
      risks,
      opportunities,
      insights,
    },
  };
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(100, Number(body?.limit || 25)));

    const { data: leads, error } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("account_id", profile.account_id)
      .not("website", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updates: Array<Record<string, any>> = [];
    const results: Array<Record<string, any>> = [];

    for (const lead of leads || []) {
      const website = normalizeWebsite(lead.website);
      if (!website) continue;

      const fetched = await fetchWebsite(website);
      const signals = detectSignals(fetched.html, fetched.text, website);
      const discoveredEmails = extractEmails(fetched.html, fetched.text);
      const discoveredPhones = extractPhones(fetched.html, fetched.text);
      const contactPageUrl = extractContactPageUrl(fetched.html, website);

      const ai =
        (await analyzeWithOpenAI({
          companyName: lead.company_name || "Unknown Company",
          website,
          websiteText: fetched.text,
          currentNeed: lead.detected_need || null,
          currentService: lead.recommended_service_line || null,
        })) ||
        fallbackAnalysis({
          companyName: lead.company_name || "Unknown Company",
          website,
          signals,
        });

      const mergedAccessScore = Number.isFinite(Number(ai.access_score))
        ? Number(ai.access_score)
        : Number(lead.access_score || 0);

      const contactBoost = discoveredEmails.length || discoveredPhones.length ? 10 : 0;
      const finalAccessScore = Math.min(100, mergedAccessScore + contactBoost);

      updates.push({
        id: lead.id,
        detected_need: ai.detected_need || lead.detected_need,
        recommended_service_line: ai.recommended_service_line || lead.recommended_service_line,
        fit_score: Number.isFinite(Number(ai.fit_score)) ? Number(ai.fit_score) : lead.fit_score,
        need_score: Number.isFinite(Number(ai.need_score)) ? Number(ai.need_score) : lead.need_score,
        urgency_score: Number.isFinite(Number(ai.urgency_score)) ? Number(ai.urgency_score) : lead.urgency_score,
        access_score: finalAccessScore,
        total_score: Number.isFinite(Number(ai.total_score)) ? Number(ai.total_score) : lead.total_score,
        ai_score: Number.isFinite(Number(ai.total_score)) ? Number(ai.total_score) : lead.ai_score ?? lead.total_score,
        ai_summary: ai.ai_summary || lead.ai_summary,
        ai_reasoning: ai.ai_reasoning || lead.ai_reasoning,
        outreach_angle: ai.outreach_angle || lead.outreach_angle,
        first_touch_message: ai.first_touch_message || lead.first_touch_message,
        contact_email: lead.contact_email || discoveredEmails[0] || null,
        contact_phone: lead.contact_phone || discoveredPhones[0] || null,
        discovered_emails: discoveredEmails,
        discovered_phones: discoveredPhones,
        contact_page_url: contactPageUrl,
        source_quality_score: discoveredEmails.length || discoveredPhones.length ? 90 : 65,
        website_analysis: {
          ...(ai.website_analysis || {}),
          fetch_ok: fetched.ok,
          http_status: fetched.status,
          analyzed_website: website,
          detected_signals: signals,
          discovered_emails: discoveredEmails,
          discovered_phones: discoveredPhones,
          contact_page_url: contactPageUrl,
        },
        website_analyzed_at: new Date().toISOString(),
        website_analysis_model: process.env.OPENAI_LEAD_WEBSITE_MODEL || "fallback",
      });

      results.push({
        id: lead.id,
        company_name: lead.company_name,
        website,
        recommended_service_line: ai.recommended_service_line,
        detected_need: ai.detected_need,
        discovered_emails: discoveredEmails,
        discovered_phones: discoveredPhones,
      });
    }

    for (const update of updates) {
      const { id, ...patch } = update;
      await supabase
        .from("lead_prospects")
        .update(patch)
        .eq("id", id)
        .eq("account_id", profile.account_id);
    }

    return NextResponse.json({
      ok: true,
      analyzed: updates.length,
      results,
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/analyze-websites error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}