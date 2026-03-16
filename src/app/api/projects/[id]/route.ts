import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function normalizeDateOnly(v: any) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (isNaN(d.getTime())) return null;

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeStage(v: any) {
  if (!v) return null;
  const s = String(v).trim();

  const allowed = ["Intake", "Planning", "Design", "Development", "QA", "Launch", "Support"];
  return allowed.includes(s) ? s : null;
}

function normalizeHealth(v: any) {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  const allowed = ["GREEN", "YELLOW", "RED", "UNKNOWN"];
  return allowed.includes(s) ? s : null;
}

function normalizeNumber(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePercent(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }

  const { id } = await context.params;

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, opportunity_id, company_id, name, status, stage, start_date, due_date, support_cost, support_due_date, delivery_cost, support_monthly_cost, support_start_date, support_next_due_date, support_status, progress_percent, owner_user_id, created_at, health, account_id, created_by, description, internal_notes"
    )
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return NextResponse.json({ project: data }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.account_id) {
    return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  }
  if (!isStaff(profile.role)) {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const { data: existing, error: existingErr } = await supabase
    .from("projects")
    .select("id, account_id, company_id, opportunity_id")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const patch: Record<string, any> = {};

  if ("name" in body) patch.name = body.name ? String(body.name).trim() : null;
  if ("status" in body) patch.status = body.status ? String(body.status).trim() : null;

  if ("stage" in body) {
    const stage = normalizeStage(body.stage);
    if (body.stage && !stage) {
      return NextResponse.json(
        { error: "Invalid stage. Allowed values: Intake, Planning, Design, Development, QA, Launch, Support" },
        { status: 400 }
      );
    }
    patch.stage = stage;
  }

  if ("health" in body) {
    const health = normalizeHealth(body.health);
    if (body.health && !health) {
      return NextResponse.json(
        { error: "Invalid health. Allowed values: GREEN, YELLOW, RED, UNKNOWN" },
        { status: 400 }
      );
    }
    patch.health = health;
  }

  if ("start_date" in body) patch.start_date = normalizeDateOnly(body.start_date);
  if ("due_date" in body) patch.due_date = normalizeDateOnly(body.due_date);
  if ("support_due_date" in body) patch.support_due_date = normalizeDateOnly(body.support_due_date);
  if ("support_start_date" in body) patch.support_start_date = normalizeDateOnly(body.support_start_date);
  if ("support_next_due_date" in body) patch.support_next_due_date = normalizeDateOnly(body.support_next_due_date);

  if ("support_cost" in body) patch.support_cost = normalizeNumber(body.support_cost);
  if ("delivery_cost" in body) patch.delivery_cost = normalizeNumber(body.delivery_cost);
  if ("support_monthly_cost" in body) patch.support_monthly_cost = normalizeNumber(body.support_monthly_cost);
  if ("progress_percent" in body) patch.progress_percent = normalizePercent(body.progress_percent);

  if ("support_status" in body) {
    patch.support_status = body.support_status ? String(body.support_status).trim() : null;
  }

  if ("owner_user_id" in body) {
    patch.owner_user_id = body.owner_user_id ? String(body.owner_user_id) : null;
  }

  if ("description" in body) {
    patch.description = body.description ? String(body.description).trim() : null;
  }

  if ("internal_notes" in body) {
    patch.internal_notes = body.internal_notes ? String(body.internal_notes).trim() : null;
  }

  let nextCompanyId = existing.company_id as string | null;
  if ("company_id" in body) {
    nextCompanyId = body.company_id ? String(body.company_id).trim() : null;

    if (nextCompanyId) {
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .select("id")
        .eq("id", nextCompanyId)
        .eq("account_id", profile.account_id)
        .maybeSingle();

      if (companyErr) return NextResponse.json({ error: companyErr.message }, { status: 500 });
      if (!company) {
        return NextResponse.json({ error: "Selected company does not belong to this account." }, { status: 400 });
      }
    }

    patch.company_id = nextCompanyId;
  }

  let nextOpportunityId = existing.opportunity_id as string | null;
  if ("opportunity_id" in body) {
    nextOpportunityId = body.opportunity_id ? String(body.opportunity_id).trim() : null;

    if (nextOpportunityId) {
      const { data: opp, error: oppErr } = await supabase
        .from("opportunities")
        .select("id, company_id")
        .eq("id", nextOpportunityId)
        .eq("account_id", profile.account_id)
        .maybeSingle();

      if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });
      if (!opp) {
        return NextResponse.json({ error: "Selected opportunity does not belong to this account." }, { status: 400 });
      }

      if (nextCompanyId && opp.company_id && opp.company_id !== nextCompanyId) {
        return NextResponse.json(
          { error: "Opportunity company does not match project company." },
          { status: 400 }
        );
      }

      patch.opportunity_id = nextOpportunityId;

      if (!patch.company_id && !existing.company_id && opp.company_id) {
        patch.company_id = opp.company_id;
      }
    } else {
      patch.opportunity_id = null;
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .select(
      "id, opportunity_id, company_id, name, status, stage, start_date, due_date, support_cost, support_due_date, delivery_cost, support_monthly_cost, support_start_date, support_next_due_date, support_status, progress_percent, owner_user_id, created_at, health, account_id, created_by, description, internal_notes"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data }, { status: 200 });
}