"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type LeadRow = Record<string, any>;
type CompanyOption = {
  id: string;
  name: string | null;
  industry?: string | null;
  customer_segment?: string | null;
  lifecycle_stage?: string | null;
};

function pretty(value: string | null | undefined) {
  return value || "N/A";
}

function chipClass(score: number | null | undefined) {
  const v = Number(score || 0);
  if (v >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (v >= 60) return "border-blue-200 bg-blue-50 text-blue-700";
  if (v >= 40) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default function LeadGenerationClient({
  leads,
  companies,
}: {
  leads: LeadRow[];
  companies: CompanyOption[];
}) {
  const [mode, setMode] = useState("icp");
  const [serviceFocus, setServiceFocus] = useState("");
  const [geography, setGeography] = useState("");
  const [industries, setIndustries] = useState("");
  const [companySizes, setCompanySizes] = useState("");
  const [buyerTitles, setBuyerTitles] = useState("");
  const [notes, setNotes] = useState("");
  const [lookalikeCompanyId, setLookalikeCompanyId] = useState("");
  const [candidateInput, setCandidateInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id || null);
  const [workingLeadId, setWorkingLeadId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "all" && String(lead.status || "") !== statusFilter) return false;
      if (serviceFilter !== "all" && String(lead.recommended_service_line || "") !== serviceFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const hay = [
        lead.company_name,
        lead.website,
        lead.industry,
        lead.detected_need,
        lead.recommended_service_line,
        lead.contact_name,
        lead.contact_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [leads, statusFilter, serviceFilter, search]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) || filteredLeads[0] || null;

  async function generateLeads() {
    try {
      setSubmitting(true);
      setError("");

      const res = await fetch("/api/lead-prospects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          serviceFocus,
          geography,
          industries,
          companySizes,
          buyerTitles,
          notes,
          candidateInput,
          lookalikeCompanyId,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate leads");
      }

      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to generate leads");
    } finally {
      setSubmitting(false);
    }
  }

  async function convertLead(leadId: string, createOpportunity: boolean) {
    try {
      setWorkingLeadId(leadId);
      setError("");

      const res = await fetch(`/api/lead-prospects/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createCompany: true,
          createOpportunity,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to convert lead");
      }

      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to convert lead");
    } finally {
      setWorkingLeadId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-4">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold">Lead Search Builder</div>
          <div className="mt-1 text-sm text-gray-500">
            Paste real candidate companies, websites, copied directories, or CSV-like text. AI will score them and recommend the best Fresh Tech offer.
          </div>

          <div className="mt-5 space-y-4">
            <FieldSelect
              label="Mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "icp", label: "ICP Mode" },
                { value: "lookalike", label: "Lookalike Mode" },
                { value: "needs_based", label: "Needs-Based Mode" },
              ]}
            />

            <FieldInput
              label="Service Focus"
              value={serviceFocus}
              onChange={setServiceFocus}
              placeholder="website, mobile_app, software, ai, support, consulting"
            />

            <FieldInput
              label="Geography"
              value={geography}
              onChange={setGeography}
              placeholder="Houston, Texas, nationwide"
            />

            <FieldInput
              label="Industries"
              value={industries}
              onChange={setIndustries}
              placeholder="churches, chambers, healthcare, nonprofits"
            />

            <FieldInput
              label="Company Sizes"
              value={companySizes}
              onChange={setCompanySizes}
              placeholder="SMB, mid-market, 10-200 employees"
            />

            <FieldInput
              label="Buyer Titles"
              value={buyerTitles}
              onChange={setBuyerTitles}
              placeholder="CEO, Founder, COO, Operations Manager"
            />

            <FieldSelect
              label="Lookalike Company"
              value={lookalikeCompanyId}
              onChange={setLookalikeCompanyId}
              options={[
                { value: "", label: "None selected" },
                ...companies.map((company) => ({
                  value: company.id,
                  label: `${company.name || "Unnamed"}${company.industry ? ` • ${company.industry}` : ""}`,
                })),
              ]}
            />

            <FieldTextarea
              label="Notes to AI"
              value={notes}
              onChange={setNotes}
              rows={4}
              placeholder="Prioritize weak digital presence, recurring customer engagement, manual workflows, or signs they need automation."
            />

            <FieldTextarea
              label="Candidate Companies / Websites / Directory Rows"
              value={candidateInput}
              onChange={setCandidateInput}
              rows={10}
              placeholder={`Paste one per line.

Examples:
ABC Medical Billing | abcbilling.com | Houston TX
Greater Heights Chamber | ghc.org | Houston
Maple Tree Kids Daycare | Rosenberg TX | daycare
company.com`}
            />

            <button
              type="button"
              onClick={generateLeads}
              disabled={submitting}
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Generating Leads..." : "Generate Lead Prospects"}
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold">How This Works</div>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <div>1. Paste real candidate businesses or websites</div>
            <div>2. AI scores fit, need, urgency, and access</div>
            <div>3. Freshware recommends the best offer and outreach angle</div>
            <div>4. Convert winners into companies and opportunities</div>
          </div>
        </section>
      </div>

      <div className="space-y-6 xl:col-span-8">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xl font-semibold">Lead Results</div>
              <div className="mt-1 text-sm text-gray-500">
                Score, qualify, and convert the best prospects.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FieldInput label="Search" value={search} onChange={setSearch} placeholder="Search leads" />
              <FieldSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "new", label: "New" },
                  { value: "converted_company", label: "Converted to Company" },
                  { value: "converted_opportunity", label: "Converted to Opportunity" },
                ]}
              />
              <FieldSelect
                label="Service"
                value={serviceFilter}
                onChange={setServiceFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "website", label: "Website" },
                  { value: "mobile_app", label: "Mobile App" },
                  { value: "software", label: "Software" },
                  { value: "ai", label: "AI" },
                  { value: "support", label: "Support" },
                  { value: "consulting", label: "Consulting" },
                ]}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <div className="overflow-hidden rounded-2xl border">
                <div className="max-h-[700px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-semibold">Lead</th>
                        <th className="px-4 py-3 text-left font-semibold">Need</th>
                        <th className="px-4 py-3 text-left font-semibold">Offer</th>
                        <th className="px-4 py-3 text-left font-semibold">Score</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className={`cursor-pointer border-b hover:bg-gray-50 ${
                            selectedLead?.id === lead.id ? "bg-gray-50" : ""
                          }`}
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold">{lead.company_name}</div>
                            <div className="text-xs text-gray-500">
                              {pretty(lead.industry)}
                              {lead.city || lead.state ? ` • ${[lead.city, lead.state].filter(Boolean).join(", ")}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">{pretty(lead.detected_need)}</td>
                          <td className="px-4 py-3 align-top">{pretty(lead.recommended_service_line)}</td>
                          <td className="px-4 py-3 align-top">
                            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${chipClass(lead.total_score)}`}>
                              {lead.total_score ?? "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">{pretty(lead.status)}</td>
                        </tr>
                      ))}

                      {!filteredLeads.length ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                            No leads yet. Generate some from the builder.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5">
              <div className="rounded-2xl border bg-gray-50 p-5">
                <div className="text-lg font-semibold">Lead Detail</div>

                {!selectedLead ? (
                  <div className="mt-4 text-sm text-gray-500">Select a lead to view details.</div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-xl font-semibold">{selectedLead.company_name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {pretty(selectedLead.industry)}
                        {selectedLead.city || selectedLead.state
                          ? ` • ${[selectedLead.city, selectedLead.state].filter(Boolean).join(", ")}`
                          : ""}
                      </div>
                    </div>

                    <InfoBlock title="Website" value={selectedLead.website} />
                    <InfoBlock title="Detected Need" value={selectedLead.detected_need} />
                    <InfoBlock title="Recommended Service" value={selectedLead.recommended_service_line} />
                    <InfoBlock title="AI Summary" value={selectedLead.ai_summary} />
                    <InfoBlock title="AI Reasoning" value={selectedLead.ai_reasoning} />
                    <InfoBlock title="Outreach Angle" value={selectedLead.outreach_angle} />
                    <InfoBlock title="First Touch Message" value={selectedLead.first_touch_message} />

                    <div className="grid grid-cols-2 gap-3">
                      <ScoreCard label="Fit" value={selectedLead.fit_score} />
                      <ScoreCard label="Need" value={selectedLead.need_score} />
                      <ScoreCard label="Urgency" value={selectedLead.urgency_score} />
                      <ScoreCard label="Access" value={selectedLead.access_score} />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => convertLead(selectedLead.id, false)}
                        disabled={workingLeadId === selectedLead.id}
                        className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60"
                      >
                        {workingLeadId === selectedLead.id ? "Working..." : "Convert to Company"}
                      </button>

                      <button
                        type="button"
                        onClick={() => convertLead(selectedLead.id, true)}
                        disabled={workingLeadId === selectedLead.id}
                        className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {workingLeadId === selectedLead.id ? "Working..." : "Convert to Opportunity"}
                      </button>

                      {selectedLead.converted_company_id ? (
                        <Link
                          href={`/dashboard/companies/${selectedLead.converted_company_id}`}
                          className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-white"
                        >
                          Open Company
                        </Link>
                      ) : null}

                      {selectedLead.converted_opportunity_id ? (
                        <Link
                          href={`/dashboard/opportunities/${selectedLead.converted_opportunity_id}`}
                          className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-white"
                        >
                          Open Opportunity
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="Total Leads" value={String(leads.length)} />
          <MiniMetric
            label="80+ Score"
            value={String(leads.filter((lead) => Number(lead.total_score || 0) >= 80).length)}
          />
          <MiniMetric
            label="Converted Companies"
            value={String(leads.filter((lead) => lead.converted_company_id).length)}
          />
          <MiniMetric
            label="Converted Opportunities"
            value={String(leads.filter((lead) => lead.converted_opportunity_id).length)}
          />
        </section>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows || 4}
        placeholder={placeholder}
        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-gray-400"
      />
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-2 text-sm text-gray-700">{value || "N/A"}</div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value ?? "N/A"}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}