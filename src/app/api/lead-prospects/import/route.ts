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

function toNullable(value: unknown) {
  const v = safeText(value);
  return v || null;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function looksLikeHeader(cols: string[]) {
  const joined = cols.join(" ").toLowerCase();
  return (
    joined.includes("company") ||
    joined.includes("website") ||
    joined.includes("email") ||
    joined.includes("industry") ||
    joined.includes("contact")
  );
}

function normalizeWebsite(raw: string | null) {
  const value = safeText(raw);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes(".")) return `https://${value}`;
  return null;
}

function rowFromColumns(cols: string[]) {
  const first = safeText(cols[0]);
  const second = safeText(cols[1]);
  const third = safeText(cols[2]);
  const fourth = safeText(cols[3]);
  const fifth = safeText(cols[4]);
  const sixth = safeText(cols[5]);

  const websiteCandidate =
    [first, second, third, fourth, fifth, sixth].find((v) => v.includes(".") || /^https?:\/\//i.test(v)) || "";

  const emailCandidate =
    [first, second, third, fourth, fifth, sixth].find((v) => v.includes("@")) || "";

  const companyName =
    first && first !== websiteCandidate && first !== emailCandidate
      ? first
      : second && second !== websiteCandidate && second !== emailCandidate
      ? second
      : first || second || "Unnamed Lead";

  return {
    company_name: companyName,
    website: normalizeWebsite(websiteCandidate),
    email: emailCandidate || null,
    city_state: [third, fourth].filter(Boolean).join(", ") || null,
    industry: fifth || null,
    raw: cols.join(", "),
  };
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || !profile.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const csvText = safeText(body?.csvText);
    const source = safeText(body?.source) || "csv_import";
    const serviceFocus = safeText(body?.serviceFocus) || null;

    if (!csvText) {
      return NextResponse.json({ error: "Missing csvText" }, { status: 400 });
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return NextResponse.json({ error: "No rows found" }, { status: 400 });
    }

    const parsed = lines.map(splitCsvLine);
    const dataRows = looksLikeHeader(parsed[0]) ? parsed.slice(1) : parsed;

    const rows = dataRows
      .map(rowFromColumns)
      .filter((row) => row.company_name)
      .slice(0, 500)
      .map((row) => ({
        account_id: profile.account_id,
        company_name: row.company_name,
        website: row.website,
        contact_email: row.email,
        source,
        source_type: "csv",
        detected_need: serviceFocus,
        recommended_service_line: serviceFocus,
        status: "new",
        fit_score: null,
        need_score: null,
        urgency_score: null,
        access_score: null,
        total_score: null,
        ai_summary: null,
        ai_reasoning: null,
        outreach_angle: null,
        first_touch_message: null,
        raw_import_row: row.raw,
        created_by: user.id,
      }));

    if (!rows.length) {
      return NextResponse.json({ error: "No valid lead rows could be parsed" }, { status: 400 });
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
    console.error("POST /api/lead-prospects/import error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}