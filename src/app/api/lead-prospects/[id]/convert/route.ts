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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const createCompany = body?.createCompany !== false;
    const createOpportunity = Boolean(body?.createOpportunity);

    const { data: lead, error: leadErr } = await supabase
      .from("lead_prospects")
      .select("*")
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    let companyId = lead.converted_company_id as string | null;
    let opportunityId = lead.converted_opportunity_id as string | null;

    if (createCompany && !companyId) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("account_id", profile.account_id)
        .ilike("name", lead.company_name)
        .limit(1)
        .maybeSingle();

      if (existingCompany?.id) {
        companyId = existingCompany.id;
      } else {
        const { data: createdCompany, error: companyCreateErr } = await supabase
          .from("companies")
          .insert({
            account_id: profile.account_id,
            name: lead.company_name,
            website: lead.website,
            linkedin_url: lead.linkedin_url,
            city: lead.city,
            state: lead.state,
            country: lead.country,
            industry: lead.industry,
            company_size: lead.company_size,
            primary_contact_name: lead.contact_name,
            primary_contact_role: lead.contact_title,
            primary_contact_email: lead.contact_email,
            primary_contact_phone: lead.contact_phone,
            top_pain_points: lead.detected_need,
            customer_segment: null,
            lifecycle_stage: "lead",
            priority_level: lead.total_score >= 80 ? "HIGH" : lead.total_score >= 60 ? "MEDIUM" : "LOW",
            relationship_summary: lead.ai_summary,
            initial_engagement_source: lead.source,
            ai_company_info: {
              executiveSummary: lead.ai_summary || "",
              marketPositioning: lead.ai_reasoning || "",
              likelyNeeds: lead.detected_need ? [lead.detected_need] : [],
              salesAngles: lead.outreach_angle ? [lead.outreach_angle] : [],
              risks: [],
              recommendedNextSteps: ["Review lead and qualify for a discovery call."],
            },
            ai_company_info_generated_at: new Date().toISOString(),
            ai_company_info_model: "lead-conversion-seed",
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

    if (createOpportunity && !opportunityId) {
      if (!companyId) {
        return NextResponse.json(
          { error: "A company must exist before creating an opportunity." },
          { status: 400 }
        );
      }

      const serviceLine = safeText(lead.recommended_service_line) || "consulting";

      const { data: createdOpportunity, error: oppErr } = await supabase
        .from("opportunities")
        .insert({
          account_id: profile.account_id,
          company_id: companyId,
          contact_id: null,
          owner_user_id: user.id,
          service_line: serviceLine,
          stage: "new",
          amount: 0,
          probability: Math.max(5, Math.min(60, Number(lead.total_score || 25))),
          close_date: null,
          name: `${lead.company_name} - ${titleCaseService(serviceLine)} Opportunity`,
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

    const nextStatus = createOpportunity ? "converted_opportunity" : createCompany ? "converted_company" : lead.status;

    const { error: updateErr } = await supabase
      .from("lead_prospects")
      .update({
        converted_company_id: companyId,
        converted_opportunity_id: opportunityId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        converted_company_id: companyId,
        converted_opportunity_id: opportunityId,
        status: nextStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/lead-prospects/[id]/convert error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}