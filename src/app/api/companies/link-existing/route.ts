import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/supabase/route";

export const runtime = "nodejs";

function isStaff(role: string | null | undefined) {
  const r = (role || "").toUpperCase();
  return ["CEO", "ADMIN", "STAFF", "OPS", "SALES", "MARKETING"].includes(r);
}

function normalizeName(v: string | null | undefined) {
  return String(v || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|l l c|corp|corporation|co|company|ltd|limited|pllc|pc|group|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST() {
  const { supabase, user, profile } = await requireViewer();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile || profile.role === "PENDING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!profile.account_id) return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const accountId = profile.account_id;

  const [companiesRes, contactsRes, oppsRes, projectsRes] = await Promise.all([
    supabase.from("companies").select("id, name").eq("account_id", accountId),
    supabase.from("contacts").select("id, account_id, company_id, name, email").eq("account_id", accountId).is("company_id", null),
    supabase.from("opportunities").select("id, account_id, company_id, name").eq("account_id", accountId).is("company_id", null).is("deleted_at", null),
    supabase.from("projects").select("id, account_id, company_id, name").eq("account_id", accountId).is("company_id", null),
  ]);

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });
  if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });
  if (oppsRes.error) return NextResponse.json({ error: oppsRes.error.message }, { status: 500 });
  if (projectsRes.error) return NextResponse.json({ error: projectsRes.error.message }, { status: 500 });

  const companies = (companiesRes.data || []) as Array<{ id: string; name: string | null }>;
  const companyMap = new Map<string, string>();

  for (const c of companies) {
    const norm = normalizeName(c.name);
    if (norm && !companyMap.has(norm)) {
      companyMap.set(norm, c.id);
    }
  }

  let linkedContacts = 0;
  let linkedOpps = 0;
  let linkedProjects = 0;

  for (const row of (contactsRes.data || []) as Array<{ id: string; name: string | null; email: string | null }>) {
    const candidates = [
      normalizeName(row.name),
      normalizeName(row.email?.split("@")[1]?.split(".")[0] || ""),
    ].filter(Boolean);

    let matchedCompanyId: string | null = null;
    for (const candidate of candidates) {
      if (companyMap.has(candidate)) {
        matchedCompanyId = companyMap.get(candidate)!;
        break;
      }
    }

    if (matchedCompanyId) {
      const { error } = await supabase
        .from("contacts")
        .update({ company_id: matchedCompanyId })
        .eq("account_id", accountId)
        .eq("id", row.id);

      if (!error) linkedContacts += 1;
    }
  }

  for (const row of (oppsRes.data || []) as Array<{ id: string; name: string | null }>) {
    const norm = normalizeName(row.name);
    let matchedCompanyId: string | null = null;

    for (const [companyNorm, companyId] of companyMap.entries()) {
      if (norm && companyNorm && (norm.includes(companyNorm) || companyNorm.includes(norm))) {
        matchedCompanyId = companyId;
        break;
      }
    }

    if (matchedCompanyId) {
      const { error } = await supabase
        .from("opportunities")
        .update({ company_id: matchedCompanyId })
        .eq("account_id", accountId)
        .eq("id", row.id);

      if (!error) linkedOpps += 1;
    }
  }

  for (const row of (projectsRes.data || []) as Array<{ id: string; name: string | null }>) {
    const norm = normalizeName(row.name);
    let matchedCompanyId: string | null = null;

    for (const [companyNorm, companyId] of companyMap.entries()) {
      if (norm && companyNorm && (norm.includes(companyNorm) || companyNorm.includes(norm))) {
        matchedCompanyId = companyId;
        break;
      }
    }

    if (matchedCompanyId) {
      const { error } = await supabase
        .from("projects")
        .update({ company_id: matchedCompanyId })
        .eq("account_id", accountId)
        .eq("id", row.id);

      if (!error) linkedProjects += 1;
    }
  }

  return NextResponse.redirect(
    new URL(`/dashboard/companies?linked=1&contacts=${linkedContacts}&opps=${linkedOpps}&projects=${linkedProjects}`, "http://localhost:3000"),
    { status: 303 }
  );
}