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

function parseCandidateLine(line: string) {
  const parts = line
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  const companyName = parts[0] || "";
  const websiteCandidate = parts.find((p) => /^https?:\/\//i.test(p) || p.includes(".")) || "";
  const emailCandidate = parts.find((p) => p.includes("@")) || "";
  const phoneCandidate =
    parts.find((p) => /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(p)) || "";
  const location =
    parts.find(
      (p) =>
        p !== websiteCandidate &&
        p !== emailCandidate &&
        p !== phoneCandidate &&
        p !== companyName
    ) || "";

  return {
    company_name: companyName || "Unnamed Lead",
    website: normalizeWebsite(websiteCandidate),
    email: normalizeEmail(emailCandidate),
    phone: normalizePhone(phoneCandidate),
    location,
    raw: line,
  };
}

function parseBusinessListBlock(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 800);

  const grouped: string[] = [];
  let buffer: string[] = [];

  for (const line of lines) {
    const looksLikeNewBusiness =
      !buffer.length ||
      /^https?:\/\//i.test(line) ||
      (line.length < 90 &&
        !line.includes("@") &&
        !/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(line) &&
        !line.toLowerCase().startsWith("website") &&
        !line.toLowerCase().startsWith("phone"));

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
      const websiteMatch = entry.match(/https?:\/\/[^\s|]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s|]*)?/);
      const emailMatch = entry.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const phoneMatch = entry.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const pieces = entry.split("|").map((v) => v.trim()).filter(Boolean);

      const companyName =
        pieces.find(
          (p) =>
            p !== websiteMatch?.[0] &&
            p !== emailMatch?.[0] &&
            p !== phoneMatch?.[0] &&
            p.length > 2
        ) || "Unnamed Lead";

      const remainder = pieces.filter((p) => p !== companyName);

      return {
        company_name: companyName,
        website: normalizeWebsite(websiteMatch?.[0] || null),
        email: normalizeEmail(emailMatch?.[0] || null),
        phone: normalizePhone(phoneMatch?.[0] || null),
        location:
          remainder.find(
            (p) => p !== websiteMatch?.[0] && p !== emailMatch?.[0] && p !== phoneMatch?.[0]
          ) || null,
        raw: entry,
        parse_confidence: websiteMatch || emailMatch || phoneMatch ? 0.85 : 0.6,
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

function buildFallbackLead(input: {
  companyName: string;
  website: string | null;
  geography: string;
  industries: string;
  serviceFocus: string;
  notes: string;
  mode: string;
}) {
  const website = input.website || "";
  const service = input.serviceFocus || "consulting";

  let detectedNeed = "Technology strategy and growth support";
  let recommendedService = service;
  let fitScore = 60;
  let needScore = 60;
  let urgencyScore = 55;
  let accessScore = website ? 72 : 42;

  if (website) {
    fitScore += 8;
    urgencyScore += 6;
  }

  if ((input.notes || "").toLowerCase().includes("automation")) {
    detectedNeed = "Workflow automation and operational efficiency";
    recommendedService = "ai";
    needScore = 78;
  } else if ((input.notes || "").toLowerCase().includes("mobile")) {
    detectedNeed = "Mobile customer experience and engagement";
    recommendedService = "mobile_app";
    needScore = 75;
  } else if ((input.notes || "").toLowerCase().includes("website")) {
    detectedNeed = "Website modernization and stronger conversion flow";
    recommendedService = "website";
    needScore = 74;
  }

  const totalScore = Math.round((fitScore + needScore + urgencyScore + accessScore) / 4);

  return {
    detected_need: detectedNeed,
    recommended_service_line: recommendedService,
    fit_score: fitScore,
    need_score: needScore,
    urgency_score: urgencyScore,
    access_score: accessScore,
    total_score: totalScore,
    ai_summary: `${input.companyName} appears to be a reasonable lead for ${titleCaseService(recommendedService)} support.`,
    ai_reasoning: `Generated from Freshware ${input.mode} mode using available targeting inputs.`,
    outreach_angle: `Lead with business value around ${detectedNeed.toLowerCase()}.`,
    first_touch_message: `Hi, I came across ${input.companyName} and noticed what looks like an opportunity around ${detectedNeed.toLowerCase()}. My team helps businesses improve growth, efficiency, and customer experience through practical ${titleCaseService(recommendedService)} support. Would you be open to a quick conversation to see if there is a fit?`,
  };
}

async function analyzeSpecificCompanyWithOpenAI(input: {
  companyName: string;
  website: string | null;
  serviceFocus: string;
  notes: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_LEAD_GEN_MODEL || "gpt-5-mini";

  const prompt = `
You are generating a single prospect record for a B2B technology agency.

Return STRICT JSON only:
{
  "detected_need": "string",
  "recommended_service_line": "website | mobile_app | software | ai | support | consulting",
  "fit_score": 0,
  "need_score": 0,
  "urgency_score": 0,
  "access_score": 0,
  "total_score": 0,
  "ai_summary": "string",
  "ai_reasoning": "string",
  "outreach_angle": "string",
  "first_touch_message": "string"
}

Company:
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

async function analyzeWebsiteWithOpenAI(input: {
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

function fallbackWebsiteAnalysis(input: {
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
  if (!profile || !profile.account_id) {
    return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  }
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));

    const modeRaw = safeText(body?.mode);
    const mode = (modeRaw || "ideal_customer") as string;
    const geography = safeText(body?.geography);
    const industries = safeText(body?.industries);
    const serviceFocus = safeText(body?.serviceFocus) || "consulting";
    const notes = safeText(body?.notes);
    const companySizes = safeText(body?.companySizes);
    const buyerTitles = safeText(body?.buyerTitles);
    const candidateInput = safeText(body?.candidateInput);
    const sourceLabelInput = safeText(body?.sourceLabel);
    const sourceUrlInput = safeText(body?.sourceUrl);
    const limit = Math.max(1, Math.min(100, Number(body?.limit || 25)));

    const accountId = profile.account_id;

    let rows: Record<string, any>[] = [];

    if (mode === "specific_company") {
      const companyName = safeText(body?.companyName);
      const website = normalizeWebsite(body?.website);

      if (!companyName && !website) {
        return NextResponse.json(
          { error: "Enter an exact company name or website." },
          { status: 400 }
        );
      }

      const baseAI =
        (await analyzeSpecificCompanyWithOpenAI({
          companyName: companyName || website || "Unnamed Lead",
          website,
          serviceFocus,
          notes,
        })) ||
        buildFallbackLead({
          companyName: companyName || website || "Unnamed Lead",
          website,
          geography,
          industries,
          serviceFocus,
          notes,
          mode,
        });

      let enriched = {
        ...baseAI,
        website_analysis: null as any,
        website_analyzed_at: null as string | null,
        website_analysis_model: null as string | null,
      };

      if (website) {
        const fetched = await fetchWebsiteText(website);
        const signals = detectSignals(fetched.html, fetched.text, website);

        const websiteAI =
          (await analyzeWebsiteWithOpenAI({
            companyName: companyName || website,
            website,
            websiteText: fetched.text,
            currentNeed: baseAI.detected_need || null,
            currentService: baseAI.recommended_service_line || null,
          })) ||
          fallbackWebsiteAnalysis({
            companyName: companyName || website,
            website,
            signals,
          });

        enriched = {
          ...baseAI,
          detected_need: websiteAI.detected_need || baseAI.detected_need,
          recommended_service_line:
            websiteAI.recommended_service_line || baseAI.recommended_service_line,
          fit_score: Number(websiteAI.fit_score ?? baseAI.fit_score ?? 0),
          need_score: Number(websiteAI.need_score ?? baseAI.need_score ?? 0),
          urgency_score: Number(websiteAI.urgency_score ?? baseAI.urgency_score ?? 0),
          access_score: Number(websiteAI.access_score ?? baseAI.access_score ?? 0),
          total_score: Number(websiteAI.total_score ?? baseAI.total_score ?? 0),
          ai_summary: websiteAI.ai_summary || baseAI.ai_summary,
          ai_reasoning: websiteAI.ai_reasoning || baseAI.ai_reasoning,
          outreach_angle: websiteAI.outreach_angle || baseAI.outreach_angle,
          first_touch_message:
            websiteAI.first_touch_message || baseAI.first_touch_message,
          website_analysis: {
            ...(websiteAI.website_analysis || {}),
            fetch_ok: fetched.ok,
            http_status: fetched.status,
            analyzed_website: website,
            detected_signals: signals,
          },
          website_analyzed_at: new Date().toISOString(),
          website_analysis_model: process.env.OPENAI_LEAD_WEBSITE_MODEL || "fallback",
        };
      }

      rows = [
        {
          account_id: accountId,
          company_name: companyName || website || "Unnamed Lead",
          website,
          industry: industries || null,
          city: geography || null,
          state: null,
          source: "specific_company",
          source_type: "manual",
          source_label: "Specific Company Analysis",
          source_url: website || null,
          source_snapshot: [companyName, website, notes].filter(Boolean).join(" | "),
          generation_mode: mode,
          detected_need: enriched.detected_need || null,
          recommended_service_line:
            enriched.recommended_service_line || serviceFocus || "consulting",
          fit_score: Number(enriched.fit_score ?? 0),
          need_score: Number(enriched.need_score ?? 0),
          urgency_score: Number(enriched.urgency_score ?? 0),
          access_score: Number(enriched.access_score ?? 0),
          total_score: Number(enriched.total_score ?? 0),
          ai_score: Number(enriched.total_score ?? 0),
          ai_summary: enriched.ai_summary || null,
          ai_reasoning: enriched.ai_reasoning || null,
          outreach_angle: enriched.outreach_angle || null,
          first_touch_message: enriched.first_touch_message || null,
          website_analysis: enriched.website_analysis || null,
          website_analyzed_at: enriched.website_analyzed_at || null,
          website_analysis_model: enriched.website_analysis_model || null,
          raw_import_row: [companyName, website, notes].filter(Boolean).join(" | "),
          created_by: user.id,
          status: "new",
          tags: ["specific_company"],
          parse_confidence: 1,
        },
      ];
    } else if (mode === "business_lists") {
      const parsedRows = parseBusinessListBlock(candidateInput);

      if (!parsedRows.length) {
        return NextResponse.json({ error: "Add at least one business listing block." }, { status: 400 });
      }

      rows = parsedRows.slice(0, limit).map((row) => {
        const ai = buildFallbackLead({
          companyName: row.company_name,
          website: row.website,
          geography,
          industries,
          serviceFocus,
          notes,
          mode,
        });

        return {
          account_id: accountId,
          company_name: row.company_name,
          website: row.website,
          contact_email: row.email,
          contact_phone: row.phone,
          industry: industries || null,
          city: geography || null,
          state: null,
          source: "business_lists",
          source_type: "directory",
          source_label: sourceLabelInput || "Business List Import",
          source_url: sourceUrlInput || null,
          source_snapshot: row.raw,
          generation_mode: mode,
          detected_need: ai.detected_need || null,
          recommended_service_line:
            ai.recommended_service_line || serviceFocus || "consulting",
          fit_score: Number(ai.fit_score ?? 0),
          need_score: Number(ai.need_score ?? 0),
          urgency_score: Number(ai.urgency_score ?? 0),
          access_score: Number(ai.access_score ?? 0),
          total_score: Number(ai.total_score ?? 0),
          ai_score: Number(ai.total_score ?? 0),
          ai_summary: ai.ai_summary || null,
          ai_reasoning: ai.ai_reasoning || null,
          outreach_angle: ai.outreach_angle || null,
          first_touch_message: ai.first_touch_message || null,
          raw_import_row: row.raw,
          created_by: user.id,
          status: "new",
          tags: ["business_list", sourceLabelInput || "directory"],
          parse_confidence: row.parse_confidence,
        };
      });
    } else {
      const syntheticRows = Array.from({ length: limit }).map((_, idx) => {
        const baseName =
          mode === "similar_to_company"
            ? `Benchmark-Match Company ${idx + 1}`
            : mode === "likely_needs"
            ? `Likely Need Prospect ${idx + 1}`
            : `Ideal Customer Prospect ${idx + 1}`;

        const ai = buildFallbackLead({
          companyName: baseName,
          website: null,
          geography,
          industries,
          serviceFocus,
          notes,
          mode,
        });

        return {
          account_id: accountId,
          company_name: baseName,
          website: null,
          contact_email: null,
          contact_phone: null,
          industry: industries || null,
          city: geography || null,
          state: null,
          source: mode,
          source_type: "manual",
          source_label:
            mode === "similar_to_company"
              ? "Lookalike Search"
              : mode === "likely_needs"
              ? "Likely Needs Search"
              : "Ideal Customer Search",
          source_url: null,
          source_snapshot: [
            geography ? `Geography: ${geography}` : null,
            industries ? `Industries: ${industries}` : null,
            companySizes ? `Company size: ${companySizes}` : null,
            buyerTitles ? `Buyer titles: ${buyerTitles}` : null,
            notes || null,
          ]
            .filter(Boolean)
            .join(" | "),
          generation_mode: mode,
          detected_need: ai.detected_need || null,
          recommended_service_line:
            ai.recommended_service_line || serviceFocus || "consulting",
          fit_score: Number(ai.fit_score ?? 0),
          need_score: Number(ai.need_score ?? 0),
          urgency_score: Number(ai.urgency_score ?? 0),
          access_score: Number(ai.access_score ?? 0),
          total_score: Number(ai.total_score ?? 0),
          ai_score: Number(ai.total_score ?? 0),
          ai_summary: ai.ai_summary || null,
          ai_reasoning: ai.ai_reasoning || null,
          outreach_angle: ai.outreach_angle || null,
          first_touch_message: ai.first_touch_message || null,
          raw_import_row: null,
          created_by: user.id,
          status: "new",
          tags: [mode],
          parse_confidence: 0.55,
        };
      });

      rows = syntheticRows;
    }

    const { data, error } = await supabase
      .from("lead_prospects")
      .insert(rows)
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
      leads: data || [],
    });
  } catch (error) {
    console.error("POST /api/lead-prospects/generate error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}