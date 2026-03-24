"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type LeadRow = Record<string, any>;
type CompanyOption = {
  id: string;
  name: string | null;
  industry?: string | null;
  customer_segment?: string | null;
  lifecycle_stage?: string | null;
};

type ModeValue = "ideal_customer" | "similar_to_company" | "needs_based";

function pretty(value: string | null | undefined) {
  return value || "N/A";
}

function scoreChipClass(score: number | null | undefined) {
  const v = Number(score || 0);
  if (v >= 80) return "border-black bg-black text-white";
  if (v >= 60) return "border-gray-900 bg-gray-900 text-white";
  if (v >= 40) return "border-gray-300 bg-gray-100 text-gray-900";
  return "border-gray-200 bg-white text-gray-700";
}

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function LeadGenerationClient({
  leads,
  companies,
}: {
  leads: LeadRow[];
  companies: CompanyOption[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<ModeValue>("ideal_customer");
  const [serviceFocus, setServiceFocus] = useState("");
  const [geography, setGeography] = useState("");
  const [industries, setIndustries] = useState("");
  const [companySizes, setCompanySizes] = useState("");
  const [buyerTitles, setBuyerTitles] = useState("");
  const [notes, setNotes] = useState("");
  const [lookalikeCompanyId, setLookalikeCompanyId] = useState("");
  const [candidateInput, setCandidateInput] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importSource, setImportSource] = useState("directory_import");

  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id || null);
  const [workingLeadId, setWorkingLeadId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"all" | "80_plus">("all");

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2600);
    return () => clearTimeout(t);
  }, [success]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "all" && String(lead.status || "") !== statusFilter) return false;
      if (serviceFilter !== "all" && String(lead.recommended_service_line || "") !== serviceFilter) return false;
      if (scoreFilter === "80_plus" && Number(lead.total_score || 0) < 80) return false;

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
  }, [leads, statusFilter, serviceFilter, search, scoreFilter]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ||
    leads.find((lead) => lead.id === selectedLeadId) ||
    filteredLeads[0] ||
    null;

  const leadsWithWebsites = useMemo(
    () => leads.filter((lead) => String(lead.website || "").trim()),
    [leads]
  );

  const analyzedCount = useMemo(
    () => leads.filter((lead) => lead.website_analyzed_at).length,
    [leads]
  );

  const score80Count = useMemo(
    () => leads.filter((lead) => Number(lead.total_score || 0) >= 80).length,
    [leads]
  );

  const selectedTotalScore =
    safeNumber(selectedLead?.total_score) ??
    (() => {
      const scores = [
        safeNumber(selectedLead?.fit_score),
        safeNumber(selectedLead?.need_score),
        safeNumber(selectedLead?.urgency_score),
        safeNumber(selectedLead?.access_score),
      ].filter((v): v is number => v !== null);

      if (!scores.length) return null;
      return Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length);
    })();

  async function generateLeads() {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const apiMode =
        mode === "ideal_customer"
          ? "icp"
          : mode === "similar_to_company"
          ? "lookalike"
          : "needs_based";

      const res = await fetch("/api/lead-prospects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: apiMode,
          serviceFocus,
          geography,
          industries,
          companySizes,
          buyerTitles,
          notes,
          candidateInput,
          lookalikeCompanyId: mode === "similar_to_company" ? lookalikeCompanyId : "",
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate leads");
      }

      setSuccess(`Generated ${json?.count || 0} lead prospect${json?.count === 1 ? "" : "s"}.`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to generate leads");
    } finally {
      setSubmitting(false);
    }
  }

  async function importCsv() {
    try {
      setImporting(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/lead-prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          source: importSource,
          serviceFocus,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to import CSV");
      }

      setSuccess(`Imported ${json?.count || 0} lead${json?.count === 1 ? "" : "s"}.`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to import CSV");
    } finally {
      setImporting(false);
    }
  }

  async function analyzeWebsites() {
    try {
      setAnalyzing(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/lead-prospects/analyze-websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to analyze websites");
      }

      setSuccess(`Analyzed ${json?.analyzed || 0} website${json?.analyzed === 1 ? "" : "s"}.`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to analyze websites");
    } finally {
      setAnalyzing(false);
    }
  }

  async function convertLead(leadId: string, createOpportunity: boolean) {
    try {
      setWorkingLeadId(leadId);
      setError("");
      setSuccess("");

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

      setSuccess(createOpportunity ? "Lead converted to company and opportunity." : "Lead converted to company.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to convert lead");
    } finally {
      setWorkingLeadId(null);
    }
  }

  async function handleCsvFile(file: File) {
    try {
      const text = await file.text();
      setCsvText(text);
      setSuccess(`Loaded file: ${file.name}`);
      setError("");
    } catch {
      setError("Could not read CSV file.");
    }
  }

  const showLookalikeFields = mode === "similar_to_company";

  return (
    <div className="grid gap-6 xl:grid-cols-12 bg-white">
      <div className="space-y-6 xl:col-span-4">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold text-gray-900">Lead Search Builder</div>
          <div className="mt-1 text-sm text-gray-500">
            Generate leads from your ideal customer profile, based on a similar company, or based on likely needs.
          </div>

          <div className="mt-5 space-y-4">
            <FieldSelect
              label="Lead Generation Method"
              value={mode}
              onChange={(v) => setMode(v as ModeValue)}
              options={[
                { value: "ideal_customer", label: "Ideal Customer Search" },
                { value: "similar_to_company", label: "Similar to an Existing Company" },
                { value: "needs_based", label: "Find Companies with Likely Needs" },
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

            {mode !== "needs_based" ? (
              <>
                <FieldInput
                  label="Company Size"
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
              </>
            ) : null}

            {showLookalikeFields ? (
              <FieldSelect
                label="Use This Company as the Benchmark"
                value={lookalikeCompanyId}
                onChange={setLookalikeCompanyId}
                options={[
                  { value: "", label: "Select a company" },
                  ...companies.map((company) => ({
                    value: company.id,
                    label: `${company.name || "Unnamed"}${company.industry ? ` • ${company.industry}` : ""}`,
                  })),
                ]}
              />
            ) : null}

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

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold text-gray-900">CSV / Directory Import</div>
          <div className="mt-1 text-sm text-gray-500">
            Upload a CSV file or paste copied rows from chamber lists, association member exports, or business directories.
          </div>

          <div className="mt-5 space-y-4">
            <FieldInput
              label="Import Source"
              value={importSource}
              onChange={setImportSource}
              placeholder="directory_import, chamber_export, conference_list"
            />

            <div>
              <div className="mb-2 text-sm font-semibold text-gray-900">Upload CSV File</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-gray-50"
                >
                  Choose CSV File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvText("");
                    setSuccess("");
                  }}
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                }}
              />
            </div>

            <FieldTextarea
              label="Or Paste CSV Text"
              value={csvText}
              onChange={setCsvText}
              rows={10}
              placeholder={`company_name,website,city,state,industry,email
ABC Medical Billing,abcbilling.com,Houston,TX,Healthcare,owner@abc.com
Maple Tree Kids Daycare,mapletree.com,Rosenberg,TX,Childcare,info@mapletree.com`}
            />

            <button
              type="button"
              onClick={importCsv}
              disabled={importing}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import CSV / Directory Leads"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold text-gray-900">Website Discovery</div>
          <div className="mt-1 text-sm text-gray-500">
            Analyze imported lead websites in batch to detect digital maturity, likely need, and best service fit.
          </div>

          <div className="mt-5 space-y-3 text-sm text-gray-600">
            <div>Leads with websites: {leadsWithWebsites.length}</div>
            <div>Analyzed leads: {analyzedCount}</div>
          </div>

          <button
            type="button"
            onClick={analyzeWebsites}
            disabled={analyzing || !leadsWithWebsites.length}
            className="mt-5 w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {analyzing ? "Analyzing Websites..." : "Analyze Lead Websites"}
          </button>
        </section>

        {success ? (
          <div className="rounded-2xl border border-black bg-black p-4 text-sm text-white">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="space-y-6 xl:col-span-8">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xl font-semibold text-gray-900">Lead Results</div>
              <div className="mt-1 text-sm text-gray-500">
                Score, enrich, qualify, and convert the best prospects.
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
                    <thead className="sticky top-0 bg-white">
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
                            {lead.website ? (
                              <div className="mt-1 text-xs text-blue-700 break-all">{lead.website}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top">{pretty(lead.detected_need)}</td>
                          <td className="px-4 py-3 align-top">{pretty(lead.recommended_service_line)}</td>
                          <td className="px-4 py-3 align-top">
                            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${scoreChipClass(lead.total_score)}`}>
                              {lead.total_score ?? "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top">{pretty(lead.status)}</td>
                        </tr>
                      ))}

                      {!filteredLeads.length ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                            No leads match the current filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5">
              <div className="rounded-2xl border bg-white p-5">
                <div className="text-lg font-semibold text-gray-900">Lead Detail</div>

                {!selectedLead ? (
                  <div className="mt-4 text-sm text-gray-500">Select a lead to view details.</div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-xl font-semibold text-gray-900">{selectedLead.company_name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {pretty(selectedLead.industry)}
                        {selectedLead.city || selectedLead.state
                          ? ` • ${[selectedLead.city, selectedLead.state].filter(Boolean).join(", ")}`
                          : ""}
                      </div>
                    </div>

                    <InfoBlock title="Overall Score" value={selectedTotalScore != null ? String(selectedTotalScore) : "N/A"} strong />
                    <InfoBlock title="Detected Need" value={selectedLead.detected_need} />
                    <InfoBlock title="Recommended Service" value={selectedLead.recommended_service_line} />
                    <InfoBlock title="AI Summary" value={selectedLead.ai_summary} />
                    <InfoBlock title="AI Reasoning" value={selectedLead.ai_reasoning} />
                    <InfoBlock title="Outreach Angle" value={selectedLead.outreach_angle} />
                    <InfoBlock title="First Touch Message" value={selectedLead.first_touch_message} />
                    <InfoBlock
                      title="Website Analysis"
                      value={
                        selectedLead.website_analysis
                          ? JSON.stringify(selectedLead.website_analysis, null, 2)
                          : "Not analyzed yet."
                      }
                      pre
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <ScoreCard label="Fit" value={selectedLead.fit_score} />
                      <ScoreCard label="Need" value={selectedLead.need_score} />
                      <ScoreCard label="Urgency" value={selectedLead.urgency_score} />
                      <ScoreCard label="Access" value={selectedLead.access_score} />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedLead.converted_company_id ? (
                        <Link
                          href={`/dashboard/companies/${selectedLead.converted_company_id}`}
                          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                        >
                          Open Company
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => convertLead(selectedLead.id, false)}
                          disabled={workingLeadId === selectedLead.id}
                          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {workingLeadId === selectedLead.id ? "Working..." : "Convert to Company"}
                        </button>
                      )}

                      {selectedLead.converted_opportunity_id ? (
                        <Link
                          href={`/dashboard/opportunities/${selectedLead.converted_opportunity_id}`}
                          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                        >
                          Open Opportunity
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => convertLead(selectedLead.id, true)}
                          disabled={workingLeadId === selectedLead.id}
                          className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {workingLeadId === selectedLead.id ? "Working..." : "Convert to Opportunity"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricButton
            label="Total Leads"
            value={String(leads.length)}
            active={scoreFilter === "all"}
            onClick={() => setScoreFilter("all")}
          />
          <MetricCard label="With Websites" value={String(leadsWithWebsites.length)} />
          <MetricCard label="Analyzed" value={String(analyzedCount)} />
          <MetricButton
            label="80+ Score"
            value={String(score80Count)}
            active={scoreFilter === "80_plus"}
            onClick={() => setScoreFilter(scoreFilter === "80_plus" ? "all" : "80_plus")}
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
      <div className="mb-2 text-sm font-semibold text-gray-900">{label}</div>
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
      <div className="mb-2 text-sm font-semibold text-gray-900">{label}</div>
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
      <div className="mb-2 text-sm font-semibold text-gray-900">{label}</div>
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

function InfoBlock({
  title,
  value,
  pre,
  strong,
}: {
  title: string;
  value: string | null | undefined;
  pre?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div
        className={`mt-2 text-sm text-gray-700 ${pre ? "whitespace-pre-wrap font-mono text-xs" : ""} ${
          strong ? "text-2xl font-semibold text-gray-900" : ""
        }`}
      >
        {value || "N/A"}
      </div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value ?? "N/A"}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function MetricButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-6 shadow-sm text-left transition ${
        active ? "bg-black text-white border-black" : "bg-white border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-white/80" : "text-gray-500"}`}>
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${active ? "text-white" : "text-gray-900"}`}>{value}</div>
    </button>
  );
}