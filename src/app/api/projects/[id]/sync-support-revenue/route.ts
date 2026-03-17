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

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const { id } = await context.params;

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, account_id, company_id, name, support_monthly_cost, support_cost, support_start_date, support_next_due_date, support_due_date, support_status")
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle();

  if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const monthly = Number(project.support_monthly_cost ?? project.support_cost ?? 0);
  if (monthly <= 0) {
    return NextResponse.json({ error: "Project has no monthly support amount." }, { status: 400 });
  }

  const status = String(project.support_status || "").toLowerCase();
  if (status && ["inactive", "paused", "canceled"].includes(status)) {
    return NextResponse.json({ error: "Project support is not active." }, { status: 400 });
  }

  const startDate =
    normalizeDateOnly(project.support_start_date) ||
    normalizeDateOnly(project.support_next_due_date) ||
    normalizeDateOnly(project.support_due_date) ||
    normalizeDateOnly(new Date().toISOString());

  const { data: existing, error: existingErr } = await supabase
    .from("revenue_entries")
    .select("id")
    .eq("account_id", profile.account_id)
    .eq("project_id", project.id)
    .eq("source", "project_support")
    .eq("frequency", "monthly")
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from("revenue_entries")
      .update({
        title: project.name ? `${project.name} Monthly Support` : "Monthly Support",
        amount: monthly,
        recognized_on: startDate,
        start_date: startDate,
        revenue_type: "support",
        category: "monthly_support",
        status: "active",
        source: "project_support",
        frequency: "monthly",
        company_id: project.company_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ revenue: updated, mode: "updated" }, { status: 200 });
  }

  const { data: created, error: createErr } = await supabase
    .from("revenue_entries")
    .insert({
      account_id: profile.account_id,
      company_id: project.company_id || null,
      project_id: project.id,
      revenue_type: "support",
      category: "monthly_support",
      title: project.name ? `${project.name} Monthly Support` : "Monthly Support",
      description: "Recurring monthly support revenue tied to project.",
      amount: monthly,
      recognized_on: startDate,
      start_date: startDate,
      status: "active",
      source: "project_support",
      frequency: "monthly",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

  return NextResponse.json({ revenue: created, mode: "created" }, { status: 201 });
}