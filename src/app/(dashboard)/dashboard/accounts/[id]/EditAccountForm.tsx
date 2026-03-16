"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type Company = {
  id: string;
  account_id: string;
  name: string | null;
  legal_name: string | null;
  website: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  preferred_contact_method: string | null;
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  industry: string | null;
  company_size: string | null;
  employee_count_range: string | null;
  revenue_band: string | null;
  business_model: string | null;
  ownership_type: string | null;
  procurement_cycle_days: number | null;
  company_age: string | null;
  organizational_structure: string | null;
  revenue_level: string | null;
  core_competencies: string | null;
  initial_engagement_source: string | null;
  relationship_summary: string | null;
  primary_business_goals: string | null;
  top_pain_points: string | null;
  buying_motivations: string | null;
  risk_tolerance: string | null;
  values_culture_signals: string | null;
  primary_software_platforms: string | null;
  integration_points: string | null;
  it_decision_maker: string | null;
  security_compliance_requirements: string | null;
  customer_segment: string | null;
  lifecycle_stage: string | null;
  priority_level: string | null;
  buying_committee: string | null;
  approval_thresholds: string | null;
  procurement_steps: string | null;
  preferred_vendors_rules: string | null;
  objections_negotiation_levers: string | null;
  support_interactions: string | null;
  renewal_churn_signals: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  ai_summary: string | null;
  ai_last_enriched_at: string | null;
  custom_tags: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MiniContact = {
  id: string;
  name: string | null;
  email: string | null;
  title: string | null;
};

type MiniOpportunity = {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
};

type MiniProject = {
  id: string;
  name: string | null;
  status: string | null;
  health: string | null;
  progress_percent: number | null;
};

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function fmtMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

function inputDateValue(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function EditAccountForm({
  initial,
  initialContacts,
  initialOpportunities,
  initialProjects,
}: {
  initial: Company;
  initialContacts: MiniContact[];
  initialOpportunities: MiniOpportunity[];
  initialProjects: MiniProject[];
}) {
  const router = useRouter();

  const [tab, setTab] = useState<
    "Overview" | "Core" | "Commercial" | "Technology" | "Operations" | "Risk"
  >("Overview");

  const [form, setForm] = useState<Company>(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof Company>(key: K, value: Company[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const stats = useMemo(() => {
    const openOppValue = (initialOpportunities || []).reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const avgProgress =
      initialProjects.length > 0
        ? Math.round(
            initialProjects.reduce((sum, p) => sum + Number(p.progress_percent || 0), 0) /
              initialProjects.length
          )
        : 0;

    return {
      contacts: initialContacts.length,
      opportunities: initialOpportunities.length,
      projects: initialProjects.length,
      openOppValue,
      avgProgress,
    };
  }, [initialContacts, initialOpportunities, initialProjects]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = (form.name || "").trim();
    if (!name) return setError("Please enter a company name.");

    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name,
          contract_start_date: inputDateValue(form.contract_start_date),
          contract_end_date: inputDateValue(form.contract_end_date),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to update company.");
        setSaving(false);
        return;
      }

      setForm(json.company || form);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error updating company.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setError(null);

    const ok = window.confirm(
      "Delete this company profile? This will fail if linked contacts, opportunities, or projects still point to it."
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${initial.id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to delete company.");
        setDeleting(false);
        return;
      }

      router.push("/dashboard/accounts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error deleting company.");
    } finally {
      setDeleting(false);
    }
  }

  async function onEnrich() {
    setError(null);
    setEnriching(true);
    try {
      const res = await fetch(`/api/accounts/${initial.id}/enrich`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Failed to enrich company data.");
        setEnriching(false);
        return;
      }

      if (json?.company) {
        setForm(json.company);
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected enrichment error.");
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Company Profile"
        subtitle="Build a full intelligence profile for this customer company."
        right={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEnrich}
              disabled={saving || deleting || enriching}
              className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {enriching ? "Generating..." : "Generate Company Data"}
            </button>
            <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
              Back to Company Profiles
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="space-y-4 xl:col-span-3">
          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Company</div>
                <div className="text-2xl font-semibold">{form.name || "Untitled Company"}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {form.industry || "No industry yet"} • {form.customer_segment || "No segment"} •{" "}
                  {form.lifecycle_stage || "No lifecycle stage"}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-2xl border p-3">
                  <div className="text-xs text-muted-foreground">Open pipeline</div>
                  <div className="mt-1 text-lg font-semibold">{fmtMoney(stats.openOppValue)}</div>
                </div>
                <div className="rounded-2xl border p-3">
                  <div className="text-xs text-muted-foreground">Avg project progress</div>
                  <div className="mt-1 text-lg font-semibold">{stats.avgProgress}%</div>
                </div>
              </div>
            </div>

            {form.ai_summary ? (
              <div className="mt-4 rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">AI Summary</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {form.ai_summary}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Last enriched: {fmtDateTime(form.ai_last_enriched_at)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-background p-2 shadow-sm">
            <div className="flex flex-wrap gap-2 p-2">
              {(["Overview", "Core", "Commercial", "Technology", "Operations", "Risk"] as const).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 ${
                      tab === t ? "bg-gray-50" : ""
                    }`}
                    type="button"
                  >
                    {t}
                  </button>
                )
              )}
            </div>
          </div>

          <form onSubmit={onSave} className="space-y-4">
            {tab === "Overview" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Section title="Relationship Summary">
                  <TextArea
                    label="Relationship and how developed"
                    value={form.relationship_summary}
                    onChange={(v) => setField("relationship_summary", v)}
                  />
                  <TextArea
                    label="Primary business goals"
                    value={form.primary_business_goals}
                    onChange={(v) => setField("primary_business_goals", v)}
                  />
                  <TextArea
                    label="Top pain points"
                    value={form.top_pain_points}
                    onChange={(v) => setField("top_pain_points", v)}
                  />
                  <TextArea
                    label="Buying motivations"
                    value={form.buying_motivations}
                    onChange={(v) => setField("buying_motivations", v)}
                  />
                </Section>

                <Section title="Commercial Snapshot">
                  <Field label="Customer segment">
                    <input
                      value={form.customer_segment || ""}
                      onChange={(e) => setField("customer_segment", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Lifecycle stage">
                    <input
                      value={form.lifecycle_stage || ""}
                      onChange={(e) => setField("lifecycle_stage", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Priority level">
                    <input
                      value={form.priority_level || ""}
                      onChange={(e) => setField("priority_level", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Company status">
                    <input
                      value={form.status || ""}
                      onChange={(e) => setField("status", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                </Section>
              </div>
            ) : null}

            {tab === "Core" ? (
              <Section title="Core Identity and Contacts">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Company name">
                    <input
                      value={form.name || ""}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Legal name">
                    <input
                      value={form.legal_name || ""}
                      onChange={(e) => setField("legal_name", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      value={form.website || ""}
                      onChange={(e) => setField("website", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="LinkedIn URL">
                    <input
                      value={form.linkedin_url || ""}
                      onChange={(e) => setField("linkedin_url", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="General email">
                    <input
                      value={form.email || ""}
                      onChange={(e) => setField("email", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="General phone">
                    <input
                      value={form.phone || ""}
                      onChange={(e) => setField("phone", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Primary contact name">
                    <input
                      value={form.primary_contact_name || ""}
                      onChange={(e) => setField("primary_contact_name", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Primary contact role/title">
                    <input
                      value={form.primary_contact_role || ""}
                      onChange={(e) => setField("primary_contact_role", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Primary contact email">
                    <input
                      value={form.primary_contact_email || ""}
                      onChange={(e) => setField("primary_contact_email", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Primary contact phone">
                    <input
                      value={form.primary_contact_phone || ""}
                      onChange={(e) => setField("primary_contact_phone", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>

                  <Field label="Mailing address" className="md:col-span-2">
                    <input
                      value={form.mailing_address || ""}
                      onChange={(e) => setField("mailing_address", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>

                  <Field label="City">
                    <input
                      value={form.city || ""}
                      onChange={(e) => setField("city", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="State">
                    <input
                      value={form.state || ""}
                      onChange={(e) => setField("state", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Postal code">
                    <input
                      value={form.postal_code || ""}
                      onChange={(e) => setField("postal_code", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      value={form.country || ""}
                      onChange={(e) => setField("country", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Preferred contact method">
                    <input
                      value={form.preferred_contact_method || ""}
                      onChange={(e) => setField("preferred_contact_method", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
              </Section>
            ) : null}

            {tab === "Commercial" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Section title="Firmographic and Business">
                  <GridTextField label="Industry" value={form.industry} onChange={(v) => setField("industry", v)} />
                  <GridTextField
                    label="Company size"
                    value={form.company_size}
                    onChange={(v) => setField("company_size", v)}
                  />
                  <GridTextField
                    label="Employee count range"
                    value={form.employee_count_range}
                    onChange={(v) => setField("employee_count_range", v)}
                  />
                  <GridTextField
                    label="Revenue band"
                    value={form.revenue_band}
                    onChange={(v) => setField("revenue_band", v)}
                  />
                  <GridTextField
                    label="Business model"
                    value={form.business_model}
                    onChange={(v) => setField("business_model", v)}
                  />
                  <GridTextField
                    label="Ownership type"
                    value={form.ownership_type}
                    onChange={(v) => setField("ownership_type", v)}
                  />
                  <GridTextField
                    label="Company age"
                    value={form.company_age}
                    onChange={(v) => setField("company_age", v)}
                  />
                  <GridTextField
                    label="Organizational structure"
                    value={form.organizational_structure}
                    onChange={(v) => setField("organizational_structure", v)}
                  />
                  <GridTextField
                    label="Revenue level"
                    value={form.revenue_level}
                    onChange={(v) => setField("revenue_level", v)}
                  />
                  <TextArea
                    label="Core competencies"
                    value={form.core_competencies}
                    onChange={(v) => setField("core_competencies", v)}
                  />
                </Section>

                <Section title="Buying and Segmentation">
                  <GridTextField
                    label="Customer segment"
                    value={form.customer_segment}
                    onChange={(v) => setField("customer_segment", v)}
                  />
                  <GridTextField
                    label="Lifecycle stage"
                    value={form.lifecycle_stage}
                    onChange={(v) => setField("lifecycle_stage", v)}
                  />
                  <GridTextField
                    label="Priority level"
                    value={form.priority_level}
                    onChange={(v) => setField("priority_level", v)}
                  />
                  <GridTextField
                    label="Risk tolerance"
                    value={form.risk_tolerance}
                    onChange={(v) => setField("risk_tolerance", v)}
                  />
                  <TextArea
                    label="Buying motivations"
                    value={form.buying_motivations}
                    onChange={(v) => setField("buying_motivations", v)}
                  />
                  <TextArea
                    label="Top pain points"
                    value={form.top_pain_points}
                    onChange={(v) => setField("top_pain_points", v)}
                  />
                  <TextArea
                    label="Primary business goals"
                    value={form.primary_business_goals}
                    onChange={(v) => setField("primary_business_goals", v)}
                  />
                  <TextArea
                    label="Values and culture signals"
                    value={form.values_culture_signals}
                    onChange={(v) => setField("values_culture_signals", v)}
                  />
                </Section>
              </div>
            ) : null}

            {tab === "Technology" ? (
              <Section title="Technology and Systems">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextArea
                    label="Primary software and platforms"
                    value={form.primary_software_platforms}
                    onChange={(v) => setField("primary_software_platforms", v)}
                  />
                  <TextArea
                    label="Integration points"
                    value={form.integration_points}
                    onChange={(v) => setField("integration_points", v)}
                  />
                  <TextArea
                    label="IT decision maker"
                    value={form.it_decision_maker}
                    onChange={(v) => setField("it_decision_maker", v)}
                  />
                  <TextArea
                    label="Security and compliance requirements"
                    value={form.security_compliance_requirements}
                    onChange={(v) => setField("security_compliance_requirements", v)}
                  />
                </div>
              </Section>
            ) : null}

            {tab === "Operations" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Section title="Relationship and Delivery">
                  <GridTextField
                    label="Initial engagement source"
                    value={form.initial_engagement_source}
                    onChange={(v) => setField("initial_engagement_source", v)}
                  />
                  <TextArea
                    label="Relationship summary"
                    value={form.relationship_summary}
                    onChange={(v) => setField("relationship_summary", v)}
                  />
                  <TextArea
                    label="Support interactions"
                    value={form.support_interactions}
                    onChange={(v) => setField("support_interactions", v)}
                  />
                  <TextArea
                    label="Renewal / churn signals"
                    value={form.renewal_churn_signals}
                    onChange={(v) => setField("renewal_churn_signals", v)}
                  />
                </Section>

                <Section title="Procurement and Commercial Motion">
                  <GridTextField
                    label="Procurement cycle days"
                    value={form.procurement_cycle_days?.toString() || ""}
                    onChange={(v) =>
                      setField("procurement_cycle_days", v === "" ? null : Number(v) || null)
                    }
                  />
                  <TextArea
                    label="Buying committee"
                    value={form.buying_committee}
                    onChange={(v) => setField("buying_committee", v)}
                  />
                  <TextArea
                    label="Approval thresholds"
                    value={form.approval_thresholds}
                    onChange={(v) => setField("approval_thresholds", v)}
                  />
                  <TextArea
                    label="Procurement steps"
                    value={form.procurement_steps}
                    onChange={(v) => setField("procurement_steps", v)}
                  />
                  <TextArea
                    label="Preferred vendors / rules"
                    value={form.preferred_vendors_rules}
                    onChange={(v) => setField("preferred_vendors_rules", v)}
                  />
                  <TextArea
                    label="Objections / negotiation levers"
                    value={form.objections_negotiation_levers}
                    onChange={(v) => setField("objections_negotiation_levers", v)}
                  />
                </Section>
              </div>
            ) : null}

            {tab === "Risk" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Section title="Contracts and Renewals">
                  <Field label="Contract start date">
                    <input
                      type="date"
                      value={inputDateValue(form.contract_start_date)}
                      onChange={(e) => setField("contract_start_date", e.target.value || null)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Contract end date">
                    <input
                      type="date"
                      value={inputDateValue(form.contract_end_date)}
                      onChange={(e) => setField("contract_end_date", e.target.value || null)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </Field>
                  <TextArea
                    label="Custom tags"
                    value={form.custom_tags}
                    onChange={(v) => setField("custom_tags", v)}
                  />
                </Section>

                <Section title="Risk Signals">
                  <TextArea
                    label="Risk tolerance"
                    value={form.risk_tolerance}
                    onChange={(v) => setField("risk_tolerance", v)}
                  />
                  <TextArea
                    label="Security / compliance requirements"
                    value={form.security_compliance_requirements}
                    onChange={(v) => setField("security_compliance_requirements", v)}
                  />
                  <TextArea
                    label="Renewal / churn signals"
                    value={form.renewal_churn_signals}
                    onChange={(v) => setField("renewal_churn_signals", v)}
                  />
                </Section>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || deleting || enriching}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save company profile"}
              </button>

              <Link href="/dashboard/accounts" className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </Link>

              <div className="flex-1" />

              <button
                type="button"
                onClick={onDelete}
                disabled={saving || deleting || enriching}
                className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete company"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="text-sm font-semibold">Linked Records</div>
            <div className="mt-4 grid gap-3">
              <StatCard label="Contacts" value={stats.contacts} />
              <StatCard label="Opportunities" value={stats.opportunities} />
              <StatCard label="Projects" value={stats.projects} />
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="text-sm font-semibold">Recent Contacts</div>
            <div className="mt-3 space-y-2">
              {initialContacts.map((c) => (
                <div key={c.id} className="rounded-xl border p-3">
                  <div className="text-sm font-semibold">{c.name || "Unnamed Contact"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.title || "—"} {c.email ? `• ${c.email}` : ""}
                  </div>
                </div>
              ))}
              {initialContacts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No linked contacts yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="text-sm font-semibold">Recent Opportunities</div>
            <div className="mt-3 space-y-2">
              {initialOpportunities.map((o) => (
                <div key={o.id} className="rounded-xl border p-3">
                  <div className="text-sm font-semibold">{o.name || "Untitled Opportunity"}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.stage || "—"} • {fmtMoney(o.amount)}
                  </div>
                </div>
              ))}
              {initialOpportunities.length === 0 ? (
                <div className="text-sm text-muted-foreground">No linked opportunities yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="text-sm font-semibold">Recent Projects</div>
            <div className="mt-3 space-y-2">
              {initialProjects.map((p) => (
                <div key={p.id} className="rounded-xl border p-3">
                  <div className="text-sm font-semibold">{p.name || "Untitled Project"}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.status || "—"} • {p.health || "—"} • {p.progress_percent ?? 0}%
                  </div>
                </div>
              ))}
              {initialProjects.length === 0 ? (
                <div className="text-sm text-muted-foreground">No linked projects yet.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="text-sm font-semibold">Profile Metadata</div>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div>Created: {fmtDateTime(form.created_at)}</div>
              <div>Updated: {fmtDateTime(form.updated_at)}</div>
              <div>AI Enriched: {fmtDateTime(form.ai_last_enriched_at)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm"
      />
    </Field>
  );
}

function GridTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </Field>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}