import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = String(role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function titleCaseService(service: string | null | undefined) {
  const value = String(service || "").trim();
  if (!value) return "Consulting";
  return value
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.account_id) return NextResponse.json({ error: "Missing account assignment" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const createCompany = body?.createCompany !== false;
    const createOpportunity = Boolean(body?.createOpportunity);

    const { data: lead, error: leadErr } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("id", id)
      .eq("account_id", accountId)
      .maybeSingle();

    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    let companyId = lead.converted_company_id as string | null;
    let opportunityId = lead.converted_opportunity_id as string | null;

    const websiteAnalysis = lead.website_analysis || null;
    const digitalMaturity =
      websiteAnalysis?.digital_maturity ||
      websiteAnalysis?.website_analysis?.digital_maturity ||
      null;

    const analysisOpportunities = [
      ...toArray(websiteAnalysis?.opportunities),
      ...toArray(websiteAnalysis?.website_analysis?.opportunities),
    ];

    const analysisInsights = [
      ...toArray(websiteAnalysis?.insights),
      ...toArray(websiteAnalysis?.summary_points),
    ];

    const analysisRisks = [
      ...toArray(websiteAnalysis?.risks),
      ...toArray(websiteAnalysis?.website_analysis?.risks),
    ];

    const aiCompanyInfo = {
      executiveSummary: lead.ai_summary || "",
      marketPositioning: lead.ai_reasoning || "",
      likelyNeeds: toArray(lead.detected_need),
      salesAngles: toArray(lead.outreach_angle),
      risks: analysisRisks,
      recommendedNextSteps: [
        "Review lead and qualify for a discovery call.",
        "Use website analysis insights during outreach.",
      ],
      leadWebsiteAnalysis: websiteAnalysis,
      leadScores: {
        fit: lead.fit_score,
        need: lead.need_score,
        urgency: lead.urgency_score,
        access: lead.access_score,
        total: lead.total_score,
      },
      executiveWebsiteIntel: {
        digitalMaturity,
        keyInsights: analysisInsights,
        opportunities: analysisOpportunities,
      },
    };

    // =========================
    // CREATE / MERGE COMPANY
    // =========================
    if (createCompany && !companyId) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id, ai_company_info")
        .eq("account_id", accountId)
        .ilike("name", lead.company_name)
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) {
        companyId = existingCompany.id;

        const existingInfo = existingCompany.ai_company_info || {};
        const mergedInfo = {
          ...existingInfo,
          ...aiCompanyInfo,
        };

        await supabase
          .from("companies")
          .update({
            ai_company_info: mergedInfo,
            website_analysis: websiteAnalysis,
            digital_maturity: digitalMaturity,
          })
          .eq("id", companyId)
          .eq("account_id", accountId);
      } else {
        const { data: createdCompany, error: companyCreateErr } = await supabase
          .from("companies")
          .insert({
            account_id: accountId,
            name: lead.company_name,
            website: lead.website,
            industry: lead.industry,
            primary_contact_email: lead.contact_email,
            ai_company_info: aiCompanyInfo,
            website_analysis: websiteAnalysis,
            digital_maturity: digitalMaturity,
          })
          .select("id")
          .single();

        if (companyCreateErr || !createdCompany) {
          return NextResponse.json(
            { error: companyCreateErr?.message || "Failed to create company." },
            { status: 500 }
          );
        }

        companyId = createdCompany.id;
      }
    }

    // =========================
    // CREATE OPPORTUNITY (UPDATED 🔥)
    // =========================
    if (createOpportunity && !opportunityId) {
      const serviceLine = safeText(lead.recommended_service_line) || "consulting";

      const { data: createdOpportunity, error: oppErr } = await supabase
        .from("opportunities")
        .insert({
          account_id: accountId,
          company_id: companyId,
          owner_user_id: user.id,
          service_line: serviceLine,
          stage: "new",
          amount: 0,
          probability: Math.max(5, Math.min(95, Number(lead.total_score || 25))),
          name: `${lead.company_name} - ${titleCaseService(serviceLine)} Opportunity`,

          // ✅ THIS IS THE NEW ADD
          source_lead_id: id,
        })
        .select("id")
        .single();

      if (oppErr || !createdOpportunity) {
        return NextResponse.json(
          { error: oppErr?.message || "Failed to create opportunity." },
          { status: 500 }
        );
      }

      opportunityId = createdOpportunity.id;
    }

    const nextStatus = createOpportunity
      ? "converted_opportunity"
      : createCompany
      ? "converted_company"
      : lead.status;

    await supabase
      .from("lead_prospects")
      .update({
        converted_company_id: companyId,
        converted_opportunity_id: opportunityId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("account_id", accountId);

    return NextResponse.json({
      ok: true,
      converted_company_id: companyId,
      converted_opportunity_id: opportunityId,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}