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

type OutreachEvent = Record<string, any>;

type ModeValue =
  | "ideal_customer"
  | "similar_to_company"
  | "likely_needs"
  | "specific_company"
  | "business_lists";

type SavedViewValue =
  | "all"
  | "manual_leads"
  | "not_contacted"
  | "website_opportunities"
  | "analyzed_leads"
  | "converted"
  | "new_this_week"
  | "contact_found"
  | "follow_up_due"
  | "ready_to_email"
  | "high_score_uncontacted"
  | "draft_ready"
  | "sent"
  | "manual_send_required"
  | "responded";

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function pretty(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "N/A";
}

function money(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "N/A";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
}

function toDateInputValue(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function isThisWeek(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return false;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const day = now.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() + mondayDelta);

  return d >= weekStart;
}

function isFollowUpDue(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return false;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function hasLeadContact(lead: LeadRow | null | undefined) {
  if (!lead) return false;
  return Boolean(
    lead.contact_email ||
      lead.contact_phone ||
      toArray(lead.discovered_emails).length ||
      toArray(lead.discovered_phones).length
  );
}

function titleForMode(mode: ModeValue) {
  switch (mode) {
    case "ideal_customer":
      return "Ideal Customer Search";
    case "similar_to_company":
      return "Similar to an Existing Company";
    case "likely_needs":
      return "Find Companies with Likely Needs";
    case "specific_company":
      return "Analyze a Specific Company";
    case "business_lists":
      return "Source from Business Lists";
    default:
      return "Lead Generation";
  }
}

function serviceLabel(value: unknown) {
  const v = String(value || "").trim();
  if (!v) return "N/A";
  return v
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreChipClass(score: number) {
  if (score >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 60) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function statusChipClass(status: string) {
  const s = status.toUpperCase();
  if (s === "RESPONDED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "CONTACTED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "CLOSED") return "border-zinc-300 bg-zinc-100 text-zinc-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default function LeadGenerationClient({
  leads = [],
  companies = [],
}: {
  leads?: LeadRow[];
  companies?: CompanyOption[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeCompanies = Array.isArray(companies) ? companies : [];

  const [mode, setMode] = useState<ModeValue>("ideal_customer");
  const [savedView, setSavedView] = useState<SavedViewValue>("all");

  const [serviceFocus, setServiceFocus] = useState("");
  const [geography, setGeography] = useState("");
  const [industries, setIndustries] = useState("");
  const [companySizes, setCompanySizes] = useState("");
  const [buyerTitles, setBuyerTitles] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");

  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [candidateInput, setCandidateInput] = useState("");

  const [csvText, setCsvText] = useState("");
  const [importSource, setImportSource] = useState("csv_import");
  const [generateLimit, setGenerateLimit] = useState("25");
  const [analyzeLimit, setAnalyzeLimit] = useState("25");

  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [sourceLabelFilter, setSourceLabelFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState("");

  const [recipientEmail, setRecipientEmail] = useState("");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachDraft, setOutreachDraft] = useState("");
  const [outreachNotes, setOutreachNotes] = useState("");

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("NONE");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [replyEmail, setReplyEmail] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [sendSaving, setSendSaving] = useState(false);
  const [manualSentSaving, setManualSentSaving] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [outreachSaving, setOutreachSaving] = useState(false);
  const [replySaving, setReplySaving] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [convertSaving, setConvertSaving] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const uniqueSourceLabels = useMemo(() => {
    return Array.from(
      new Set(
        safeLeads
          .map((lead) => String(lead.source_label || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [safeLeads]);

  const filteredLeads = useMemo(() => {
    return safeLeads.filter((lead) => {
      const outreachStatus = String(lead.outreach_status || "NOT_CONTACTED").toUpperCase();
      const lastStatus = String(lead.last_outreach_status || "").toUpperCase();
      const score = Number(lead.total_score || 0);
      const contactFound = hasLeadContact(lead);
      const draftFound = Boolean(lead.outreach_subject || lead.outreach_draft);
      const notContacted = outreachStatus === "NOT_CONTACTED";

      if (statusFilter !== "all" && outreachStatus !== statusFilter.toUpperCase()) return false;
      if (
        serviceFilter !== "all" &&
        String(lead.recommended_service_line || "").toLowerCase() !== serviceFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        sourceTypeFilter !== "all" &&
        String(lead.source_type || "").toLowerCase() !== sourceTypeFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        sourceLabelFilter !== "all" &&
        String(lead.source_label || "") !== sourceLabelFilter
      ) {
        return false;
      }

      if (scoreFilter === "80_plus" && score < 80) return false;
      if (scoreFilter === "60_plus" && score < 60) return false;
      if (scoreFilter === "under_60" && score >= 60) return false;

      if (savedView === "manual_leads" && String(lead.source_type || "") !== "manual") return false;
      if (savedView === "not_contacted" && !notContacted) return false;
      if (
        savedView === "website_opportunities" &&
        !(
          String(lead.recommended_service_line || "") === "website" ||
          String(lead.detected_need || "").toLowerCase().includes("website")
        )
      ) {
        return false;
      }
      if (savedView === "analyzed_leads" && !lead.website_analyzed_at) return false;
      if (savedView === "converted" && !lead.converted_company_id && !lead.converted_opportunity_id) return false;
      if (savedView === "new_this_week" && !isThisWeek(lead.created_at)) return false;
      if (savedView === "contact_found" && !contactFound) return false;
      if (savedView === "follow_up_due" && !isFollowUpDue(lead.next_follow_up_at)) return false;
      if (savedView === "ready_to_email" && !(contactFound && notContacted && score >= 70)) return false;
      if (savedView === "high_score_uncontacted" && !(notContacted && score >= 80)) return false;
      if (savedView === "draft_ready" && !draftFound) return false;
      if (savedView === "sent" && !(lastStatus === "SENT" || lastStatus === "SENT_MANUAL")) return false;
      if (savedView === "manual_send_required" && lastStatus !== "MANUAL_SEND_REQUIRED") return false;
      if (savedView === "responded" && outreachStatus !== "RESPONDED") return false;

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
        lead.contact_email,
        lead.contact_phone,
        ...toArray(lead.discovered_emails),
        ...toArray(lead.discovered_phones),
        lead.source_label,
        lead.source_type,
        lead.outreach_subject,
        lead.outreach_draft,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [
    safeLeads,
    statusFilter,
    serviceFilter,
    sourceTypeFilter,
    sourceLabelFilter,
    search,
    scoreFilter,
    savedView,
  ]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ||
    safeLeads.find((lead) => lead.id === selectedLeadId) ||
    filteredLeads[0] ||
    safeLeads[0] ||
    null;

  useEffect(() => {
    if (!selectedLeadId && (filteredLeads[0]?.id || safeLeads[0]?.id)) {
      setSelectedLeadId(filteredLeads[0]?.id || safeLeads[0]?.id || "");
    }
  }, [filteredLeads, safeLeads, selectedLeadId]);

  useEffect(() => {
    setOutreachNotes(selectedLead?.outreach_notes || "");
    setFollowUpDate(toDateInputValue(selectedLead?.next_follow_up_at));
    setFollowUpStatus(String(selectedLead?.follow_up_status || "NONE"));
    setFollowUpNotes(selectedLead?.follow_up_notes || "");

    const fallbackRecipient =
      selectedLead?.preferred_outreach_email ||
      selectedLead?.contact_email ||
      toArray(selectedLead?.discovered_emails)[0] ||
      "";

    setRecipientEmail(fallbackRecipient);
    setOutreachSubject(selectedLead?.outreach_subject || "");
    setOutreachDraft(selectedLead?.outreach_draft || selectedLead?.first_touch_message || "");
    setReplyEmail(fallbackRecipient);
    setReplyMessage("");
    setOutcomeNotes(selectedLead?.source_feedback_notes || "");
  }, [selectedLead?.id]);

  useEffect(() => {
    async function loadEvents() {
      if (!selectedLead?.id) {
        setEvents([]);
        return;
      }

      try {
        setLoadingEvents(true);
        const res = await fetch(`/api/lead-prospects/${selectedLead.id}/outreach-events`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Failed to load outreach history");
        }
        setEvents(Array.isArray(json?.events) ? json.events : []);
      } catch {
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadEvents();
  }, [selectedLead?.id]);

  const leadsWithWebsites = useMemo(
    () => safeLeads.filter((lead) => String(lead.website || "").trim()),
    [safeLeads]
  );

  const analyzedCount = useMemo(
    () => safeLeads.filter((lead) => lead.website_analyzed_at).length,
    [safeLeads]
  );

  const score80Count = useMemo(
    () => safeLeads.filter((lead) => Number(lead.total_score || 0) >= 80).length,
    [safeLeads]
  );

  const directoryLeadCount = useMemo(
    () => safeLeads.filter((lead) => String(lead.source_type || "") === "directory").length,
    [safeLeads]
  );

  const contactFoundCount = useMemo(
    () => safeLeads.filter((lead) => hasLeadContact(lead)).length,
    [safeLeads]
  );

  async function handleGenerate() {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload: Record<string, any> = {
        mode,
        serviceFocus,
        geography,
        industries,
        companySizes,
        buyerTitles,
        notes,
        limit: Number(generateLimit || 25),
      };

      if (mode === "similar_to_company") {
        payload.lookalikeCompanyId = selectedCompanyId;
      }

      if (mode === "specific_company") {
        payload.companyName = companyName;
        payload.website = website;
      }

      if (mode === "business_lists") {
        payload.sourceLabel = sourceLabel;
        payload.sourceUrl = sourceUrl;
        payload.candidateInput = candidateInput;
      }

      const res = await fetch("/api/lead-prospects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate leads");
      }

      setSuccess(`Generated ${json?.count || 0} lead prospect(s).`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to generate leads");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImportCsv() {
    try {
      setImporting(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/lead-prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, source: importSource, serviceFocus }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to import CSV");
      }

      setSuccess(`Imported ${json?.count || 0} lead prospect(s).`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to import CSV");
    } finally {
      setImporting(false);
    }
  }

  async function handleAnalyzeWebsites() {
    try {
      setAnalyzing(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/lead-prospects/analyze-websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: Number(analyzeLimit || 25) }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to analyze websites");
      }

      setSuccess(`Analyzed ${json?.analyzed || 0} website(s).`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to analyze websites");
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateOutreach() {
    if (!selectedLead?.id) return;

    try {
      setDraftSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/generate-outreach`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate outreach");
      }

      setSuccess("Outreach draft generated.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to generate outreach");
    } finally {
      setDraftSaving(false);
    }
  }

  async function generateFollowUp() {
    if (!selectedLead?.id) return;

    try {
      setDraftSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/generate-followup`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate follow-up");
      }

      setSuccess("Follow-up generated.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to generate follow-up");
    } finally {
      setDraftSaving(false);
    }
  }

  async function saveOutreachStatus() {
    if (!selectedLead?.id) return;

    try {
      setOutreachSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/update-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedLead?.outreach_status || "NOT_CONTACTED",
          notes: outreachNotes,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save outreach status");
      }

      setSuccess("Outreach status updated.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to save outreach status");
    } finally {
      setOutreachSaving(false);
    }
  }

  async function saveFollowUp() {
    if (!selectedLead?.id) return;

    try {
      setFollowUpSaving(true);
      setError("");
      setSuccess("");

      const next_follow_up_at = followUpDate ? new Date(followUpDate).toISOString() : null;

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/update-follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          next_follow_up_at,
          follow_up_status: followUpStatus,
          follow_up_notes: followUpNotes,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update follow-up");
      }

      setSuccess("Follow-up updated.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to update follow-up");
    } finally {
      setFollowUpSaving(false);
    }
  }

  async function sendOutreach() {
    if (!selectedLead?.id) return;

    try {
      setSendSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/send-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          subject: outreachSubject,
          body: outreachDraft,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to send outreach");
      }

      if (json?.manual_required && json?.mailto_url) {
        window.location.href = json.mailto_url;
        setSuccess("Opened your mail client. After sending, use Mark Email Sent.");
        return;
      }

      setSuccess("Outreach sent.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to send outreach");
    } finally {
      setSendSaving(false);
    }
  }

  async function markEmailSent() {
    if (!selectedLead?.id) return;

    try {
      setManualSentSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/mark-outreach-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          subject: outreachSubject,
          body: outreachDraft,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to mark email sent");
      }

      setSuccess("Manual outreach send logged.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to mark email sent");
    } finally {
      setManualSentSaving(false);
    }
  }

  async function logReply() {
    if (!selectedLead?.id) return;

    try {
      setReplySaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/log-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyMessage,
          sender_email: replyEmail,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to log reply");
      }

      setSuccess("Reply logged.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to log reply");
    } finally {
      setReplySaving(false);
    }
  }

  async function markOutcome(outcome: "WON" | "LOST" | "NO_RESPONSE") {
    if (!selectedLead?.id) return;

    try {
      setOutcomeSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/mark-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          notes: outcomeNotes,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to mark outcome");
      }

      setSuccess(`Lead marked ${outcome}.`);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to mark outcome");
    } finally {
      setOutcomeSaving(false);
    }
  }

  async function convertLead(createOpportunity: boolean) {
    if (!selectedLead?.id) return;

    try {
      setConvertSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/convert`, {
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

      setSuccess(
        createOpportunity
          ? "Lead converted into company + opportunity."
          : "Lead converted into company profile."
      );
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to convert lead");
    } finally {
      setConvertSaving(false);
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
  const showIdealCustomerFields = mode === "ideal_customer";
  const showNeedsFields = mode === "likely_needs";
  const showSpecificFields = mode === "specific_company";
  const showBusinessListFields = mode === "business_lists";

  const discoveredEmails = toArray(selectedLead?.discovered_emails);
  const discoveredPhones = toArray(selectedLead?.discovered_phones);

  return (
    <div className="space-y-6 pb-10">
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-4">
          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-gray-900">{titleForMode(mode)}</div>
            <div className="mt-1 text-sm text-gray-500">
              Build lead lists in a way that matches how you actually think about prospecting.
            </div>

            <div className="mt-5 space-y-4">
              <FieldSelect
                label="Lead Generation Method"
                value={mode}
                onChange={(v) => setMode(v as ModeValue)}
                options={[
                  { value: "ideal_customer", label: "Ideal Customer Search" },
                  { value: "similar_to_company", label: "Similar to an Existing Company" },
                  { value: "likely_needs", label: "Find Companies with Likely Needs" },
                  { value: "specific_company", label: "Analyze a Specific Company" },
                  { value: "business_lists", label: "Source from Business Lists" },
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

              {showIdealCustomerFields ? (
                <>
                  <FieldInput
                    label="Industries"
                    value={industries}
                    onChange={setIndustries}
                    placeholder="churches, chambers, nonprofits, healthcare"
                  />
                  <FieldInput
                    label="Company Sizes"
                    value={companySizes}
                    onChange={setCompanySizes}
                    placeholder="small business, midsize, enterprise"
                  />
                  <FieldInput
                    label="Buyer Titles"
                    value={buyerTitles}
                    onChange={setBuyerTitles}
                    placeholder="owner, founder, executive director, COO"
                  />
                </>
              ) : null}

              {showLookalikeFields ? (
                <FieldSelect
                  label="Benchmark Company"
                  value={selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  options={[
                    { value: "", label: "Select a company" },
                    ...safeCompanies.map((company) => ({
                      value: company.id,
                      label: `${company.name || "Unnamed"}${company.industry ? ` • ${company.industry}` : ""}`,
                    })),
                  ]}
                />
              ) : null}

              {showNeedsFields ? (
                <>
                  <FieldInput
                    label="Industries"
                    value={industries}
                    onChange={setIndustries}
                    placeholder="barbers, churches, chambers, restaurants"
                  />
                  <FieldInput
                    label="Buyer Titles"
                    value={buyerTitles}
                    onChange={setBuyerTitles}
                    placeholder="owner, pastor, executive director, office manager"
                  />
                </>
              ) : null}

              {showSpecificFields ? (
                <>
                  <FieldInput
                    label="Company Name"
                    value={companyName}
                    onChange={setCompanyName}
                    placeholder="Maple Tree Kids Daycare"
                  />
                  <FieldInput
                    label="Website"
                    value={website}
                    onChange={setWebsite}
                    placeholder="mapletreekids.com"
                  />
                </>
              ) : null}

              {showBusinessListFields ? (
                <>
                  <FieldInput
                    label="Source Label"
                    value={sourceLabel}
                    onChange={setSourceLabel}
                    placeholder="Houston Business Directory"
                  />
                  <FieldInput
                    label="Source URL"
                    value={sourceUrl}
                    onChange={setSourceUrl}
                    placeholder="https://example.com/directory"
                  />
                  <FieldTextarea
                    label="Business Listings / Directory Blocks"
                    value={candidateInput}
                    onChange={setCandidateInput}
                    rows={10}
                    placeholder={`Paste copied directory rows or business blocks here.

Example:
Greater Houston Black Chamber | ghbc.org | info@ghbc.org | Houston, TX
Maple Tree Kids Daycare | mapletree.com | info@mapletree.com | Rosenberg, TX`}
                  />
                </>
              ) : null}

              <FieldTextarea
                label="Notes to AI"
                value={notes}
                onChange={setNotes}
                rows={4}
                placeholder="What kinds of signs should Freshware prioritize?"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  label="Max New Leads"
                  value={generateLimit}
                  onChange={setGenerateLimit}
                  options={[
                    { value: "10", label: "10" },
                    { value: "25", label: "25" },
                    { value: "50", label: "50" },
                    { value: "75", label: "75" },
                    { value: "100", label: "100" },
                  ]}
                />
                <FieldSelect
                  label="Website Analysis Limit"
                  value={analyzeLimit}
                  onChange={setAnalyzeLimit}
                  options={[
                    { value: "10", label: "10" },
                    { value: "25", label: "25" },
                    { value: "50", label: "50" },
                    { value: "75", label: "75" },
                    { value: "100", label: "100" },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Generating..." : "Generate Leads"}
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeWebsites}
                  disabled={analyzing || !leadsWithWebsites.length}
                  className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {analyzing ? "Analyzing..." : `Analyze Websites (${Math.min(Number(analyzeLimit || 25), leadsWithWebsites.length)})`}
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold"
                >
                  Upload CSV
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

              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">CSV / Directory Import</div>
            <div className="mt-1 text-sm text-gray-500">
              Paste CSV text manually or load it from a file, then import.
            </div>

            <div className="mt-5 space-y-4">
              <FieldInput
                label="Import Source"
                value={importSource}
                onChange={setImportSource}
                placeholder="csv_import"
              />

              <FieldTextarea
                label="CSV Text"
                value={csvText}
                onChange={setCsvText}
                rows={10}
                placeholder={`company_name,website,email,city,state,industry
Maple Tree Kids Daycare,mapletree.com,info@mapletree.com,Rosenberg,TX,Daycare`}
              />

              <button
                type="button"
                onClick={handleImportCsv}
                disabled={importing || !csvText.trim()}
                className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importing ? "Importing..." : "Import CSV Leads"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-gray-900">Quick Views</div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <QuickViewButton label="All Leads" active={savedView === "all"} onClick={() => setSavedView("all")} />
              <QuickViewButton label="Manual Leads" active={savedView === "manual_leads"} onClick={() => setSavedView("manual_leads")} />
              <QuickViewButton label="Not Contacted" active={savedView === "not_contacted"} onClick={() => setSavedView("not_contacted")} />
              <QuickViewButton label="Website Opportunities" active={savedView === "website_opportunities"} onClick={() => setSavedView("website_opportunities")} />
              <QuickViewButton label="Analyzed Leads" active={savedView === "analyzed_leads"} onClick={() => setSavedView("analyzed_leads")} />
              <QuickViewButton label="Converted" active={savedView === "converted"} onClick={() => setSavedView("converted")} />
              <QuickViewButton label="New This Week" active={savedView === "new_this_week"} onClick={() => setSavedView("new_this_week")} />
              <QuickViewButton label="Contact Found" active={savedView === "contact_found"} onClick={() => setSavedView("contact_found")} />
              <QuickViewButton label="Follow-Up Due" active={savedView === "follow_up_due"} onClick={() => setSavedView("follow_up_due")} />
              <QuickViewButton label="Ready to Email" active={savedView === "ready_to_email"} onClick={() => setSavedView("ready_to_email")} />
              <QuickViewButton label="80+ Uncontacted" active={savedView === "high_score_uncontacted"} onClick={() => setSavedView("high_score_uncontacted")} />
              <QuickViewButton label="Draft Ready" active={savedView === "draft_ready"} onClick={() => setSavedView("draft_ready")} />
              <QuickViewButton label="Sent" active={savedView === "sent"} onClick={() => setSavedView("sent")} />
              <QuickViewButton label="Manual Send Required" active={savedView === "manual_send_required"} onClick={() => setSavedView("manual_send_required")} />
              <QuickViewButton label="Responded" active={savedView === "responded"} onClick={() => setSavedView("responded")} />
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-gray-900">Lead Queue</div>
                <div className="mt-1 text-sm text-gray-500">
                  {filteredLeads.length} visible lead(s) · {safeLeads.length} total
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  With websites: {leadsWithWebsites.length}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  Analyzed: {analyzedCount}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  80+: {score80Count}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  Directory: {directoryLeadCount}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                  Contact found: {contactFoundCount}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <FieldInput
                label="Search"
                value={search}
                onChange={setSearch}
                placeholder="Company, source, need, website, email"
              />

              <FieldSelect
                label="Score"
                value={scoreFilter}
                onChange={setScoreFilter}
                options={[
                  { value: "all", label: "All Scores" },
                  { value: "80_plus", label: "80+" },
                  { value: "60_plus", label: "60+" },
                  { value: "under_60", label: "Under 60" },
                ]}
              />

              <FieldSelect
                label="Outreach Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "NOT_CONTACTED", label: "NOT_CONTACTED" },
                  { value: "CONTACTED", label: "CONTACTED" },
                  { value: "RESPONDED", label: "RESPONDED" },
                  { value: "CLOSED", label: "CLOSED" },
                ]}
              />

              <FieldSelect
                label="Service"
                value={serviceFilter}
                onChange={setServiceFilter}
                options={[
                  { value: "all", label: "All Services" },
                  { value: "website", label: "website" },
                  { value: "mobile_app", label: "mobile_app" },
                  { value: "software", label: "software" },
                  { value: "ai", label: "ai" },
                  { value: "support", label: "support" },
                  { value: "consulting", label: "consulting" },
                ]}
              />

              <FieldSelect
                label="Source Type"
                value={sourceTypeFilter}
                onChange={setSourceTypeFilter}
                options={[
                  { value: "all", label: "All Source Types" },
                  { value: "manual", label: "manual" },
                  { value: "directory", label: "directory" },
                  { value: "csv", label: "csv" },
                ]}
              />

              <FieldSelect
                label="Source Label"
                value={sourceLabelFilter}
                onChange={setSourceLabelFilter}
                options={[
                  { value: "all", label: "All Source Labels" },
                  ...uniqueSourceLabels.map((label) => ({ value: label, label })),
                ]}
              />
            </div>

            <div className="mt-5 max-h-[900px] space-y-3 overflow-auto pr-1">
              {filteredLeads.length ? (
                filteredLeads.map((lead) => {
                  const score = Number(lead.total_score || 0);
                  const selected = lead.id === selectedLead?.id;
                  const outreachStatus = String(lead.outreach_status || "NOT_CONTACTED");
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected ? "border-black bg-black text-white" : "border-black/10 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${selected ? "text-white" : "text-gray-900"}`}>
                            {lead.company_name || "Unnamed Lead"}
                          </div>
                          <div className={`mt-1 text-xs ${selected ? "text-white/70" : "text-gray-500"}`}>
                            {lead.source_label || lead.source_type || "Unknown source"}
                          </div>
                          <div className={`mt-1 truncate text-xs ${selected ? "text-white/70" : "text-gray-500"}`}>
                            {lead.website || lead.contact_email || "No website or email"}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              selected ? "border-white/20 bg-white/10 text-white" : scoreChipClass(score)
                            }`}
                          >
                            Score {score}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              selected ? "border-white/20 bg-white/10 text-white" : statusChipClass(outreachStatus)
                            }`}
                          >
                            {outreachStatus}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-gray-500">
                  No leads match these filters.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:col-span-4">
          {selectedLead ? (
            <>
              <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-semibold text-gray-900">
                      {selectedLead.company_name || "Unnamed Lead"}
                    </div>
                    <div className="mt-1 break-all text-sm text-gray-500">
                      {selectedLead.website || selectedLead.contact_email || "No website / email"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreChipClass(Number(selectedLead.total_score || 0))}`}>
                        Score {Number(selectedLead.total_score || 0)}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusChipClass(String(selectedLead.outreach_status || "NOT_CONTACTED"))}`}>
                        {String(selectedLead.outreach_status || "NOT_CONTACTED")}
                      </span>
                      {selectedLead.converted_company_id || selectedLead.converted_opportunity_id ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Converted
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedLead.converted_company_id ? (
                      <Link
                        href={`/dashboard/companies/${selectedLead.converted_company_id}`}
                        className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold"
                      >
                        Open Company
                      </Link>
                    ) : null}
                    {selectedLead.converted_opportunity_id ? (
                      <Link
                        href={`/dashboard/opportunities/${selectedLead.converted_opportunity_id}`}
                        className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-semibold"
                      >
                        Open Opportunity
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InfoCard title="Recommended Service" value={serviceLabel(selectedLead.recommended_service_line)} />
                  <InfoCard title="Detected Need" value={pretty(selectedLead.detected_need)} />
                  <InfoCard title="Source" value={pretty(selectedLead.source_label || selectedLead.source_type)} />
                  <InfoCard title="Created" value={fmtDate(selectedLead.created_at)} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <TextCard title="AI Summary" value={selectedLead.ai_summary} />
                  <TextCard title="AI Reasoning" value={selectedLead.ai_reasoning} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <TextCard title="Outreach Angle" value={selectedLead.outreach_angle} />
                  <TextCard title="First Touch Message" value={selectedLead.first_touch_message} />
                </div>
              </section>

              <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold text-gray-900">Contact + Website Intelligence</div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 p-4">
                    <div className="text-sm font-semibold text-gray-900">Contact Intelligence</div>

                    <div className="mt-3 space-y-3 text-sm text-gray-700">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Primary Email</div>
                        <div className="mt-1 break-all">{pretty(selectedLead.contact_email)}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-500">Primary Phone</div>
                        <div className="mt-1">{pretty(selectedLead.contact_phone)}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-500">Discovered Emails</div>
                        {discoveredEmails.length ? (
                          <ul className="mt-1 space-y-1">
                            {discoveredEmails.map((email, idx) => (
                              <li key={`${email}-${idx}`} className="break-all">
                                {email}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-1 text-gray-500">None found</div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-500">Discovered Phones</div>
                        {discoveredPhones.length ? (
                          <ul className="mt-1 space-y-1">
                            {discoveredPhones.map((phone, idx) => (
                              <li key={`${phone}-${idx}`}>{phone}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-1 text-gray-500">None found</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 p-4">
                    <div className="text-sm font-semibold text-gray-900">Website Intelligence</div>

                    <div className="mt-3 space-y-3 text-sm text-gray-700">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">Analyzed</div>
                        <div className="mt-1">{selectedLead.website_analyzed_at ? "Yes" : "No"}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-500">Analysis Model</div>
                        <div className="mt-1">{pretty(selectedLead.website_analysis_model)}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-500">Digital Maturity</div>
                        <div className="mt-1">
                          {pretty(
                            selectedLead.website_analysis?.digital_maturity ||
                              selectedLead.website_analysis?.website_analysis?.digital_maturity
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-500">Contact Page URL</div>
                        <div className="mt-1 break-all">{pretty(selectedLead.contact_page_url)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold text-gray-900">Outreach Workspace</div>

                <div className="mt-5 grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <FieldInput
                      label="Recipient Email"
                      value={recipientEmail}
                      onChange={setRecipientEmail}
                      placeholder="recipient@company.com"
                    />
                    <FieldInput
                      label="Subject"
                      value={outreachSubject}
                      onChange={setOutreachSubject}
                      placeholder="Quick idea for your company"
                    />
                    <FieldTextarea
                      label="Draft"
                      value={outreachDraft}
                      onChange={setOutreachDraft}
                      rows={10}
                      placeholder="Generate or edit your outreach here"
                    />
                    <FieldTextarea
                      label="Outreach Notes"
                      value={outreachNotes}
                      onChange={setOutreachNotes}
                      rows={3}
                      placeholder="Internal notes about outreach"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={generateOutreach}
                        disabled={draftSaving}
                        className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {draftSaving ? "Working..." : "Generate Outreach"}
                      </button>

                      <button
                        type="button"
                        onClick={generateFollowUp}
                        disabled={draftSaving}
                        className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {draftSaving ? "Working..." : "Generate Follow-Up"}
                      </button>

                      <button
                        type="button"
                        onClick={sendOutreach}
                        disabled={sendSaving}
                        className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {sendSaving ? "Sending..." : "Send Outreach"}
                      </button>

                      <button
                        type="button"
                        onClick={markEmailSent}
                        disabled={manualSentSaving}
                        className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {manualSentSaving ? "Logging..." : "Mark Email Sent"}
                      </button>

                      <button
                        type="button"
                        onClick={saveOutreachStatus}
                        disabled={outreachSaving}
                        className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {outreachSaving ? "Saving..." : "Save Outreach Status"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <FieldInput
                      label="Follow-Up Date"
                      value={followUpDate}
                      onChange={setFollowUpDate}
                      placeholder="YYYY-MM-DDTHH:MM"
                    />
                    <FieldSelect
                      label="Follow-Up Status"
                      value={followUpStatus}
                      onChange={setFollowUpStatus}
                      options={[
                        { value: "NONE", label: "NONE" },
                        { value: "SCHEDULED", label: "SCHEDULED" },
                        { value: "DUE", label: "DUE" },
                        { value: "COMPLETED", label: "COMPLETED" },
                        { value: "PAUSED", label: "PAUSED" },
                      ]}
                    />
                    <FieldTextarea
                      label="Follow-Up Notes"
                      value={followUpNotes}
                      onChange={setFollowUpNotes}
                      rows={4}
                      placeholder="Notes for the next touchpoint"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveFollowUp}
                        disabled={followUpSaving}
                        className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {followUpSaving ? "Saving..." : "Save Follow-Up"}
                      </button>

                      <button
                        type="button"
                        onClick={() => convertLead(false)}
                        disabled={convertSaving}
                        className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {convertSaving ? "Converting..." : "Convert to Company"}
                      </button>

                      <button
                        type="button"
                        onClick={() => convertLead(true)}
                        disabled={convertSaving}
                        className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {convertSaving ? "Converting..." : "Convert to Company + Opportunity"}
                      </button>
                    </div>

                    <div className="border-t border-black/10 pt-4">
                      <FieldInput
                        label="Reply Email"
                        value={replyEmail}
                        onChange={setReplyEmail}
                        placeholder="person@company.com"
                      />
                      <FieldTextarea
                        label="Reply Message"
                        value={replyMessage}
                        onChange={setReplyMessage}
                        rows={4}
                        placeholder="Log an inbound response"
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={logReply}
                          disabled={replySaving}
                          className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                        >
                          {replySaving ? "Saving..." : "Log Reply"}
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-black/10 pt-4">
                      <FieldTextarea
                        label="Outcome Notes"
                        value={outcomeNotes}
                        onChange={setOutcomeNotes}
                        rows={4}
                        placeholder="Why won, lost, or no response?"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => markOutcome("WON")}
                          disabled={outcomeSaving}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                        >
                          Mark WON
                        </button>
                        <button
                          type="button"
                          onClick={() => markOutcome("LOST")}
                          disabled={outcomeSaving}
                          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                        >
                          Mark LOST
                        </button>
                        <button
                          type="button"
                          onClick={() => markOutcome("NO_RESPONSE")}
                          disabled={outcomeSaving}
                          className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-60"
                        >
                          Mark NO_RESPONSE
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold text-gray-900">Outreach History</div>
                <div className="mt-4 space-y-3">
                  {loadingEvents ? (
                    <div className="text-sm text-gray-500">Loading outreach history...</div>
                  ) : events.length ? (
                    events.map((event, idx) => (
                      <div key={event.id || idx} className="rounded-2xl border border-black/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {pretty(event.event_type)}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {pretty(event.channel)} · {pretty(event.direction)} · {pretty(event.delivery_status)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">{fmtDate(event.created_at)}</div>
                        </div>

                        {event.subject ? (
                          <div className="mt-3 text-sm text-gray-700">
                            <span className="font-semibold">Subject:</span> {event.subject}
                          </div>
                        ) : null}

                        {event.recipient_email ? (
                          <div className="mt-1 text-sm text-gray-700 break-all">
                            <span className="font-semibold">Recipient:</span> {event.recipient_email}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No outreach history yet.</div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">No Lead Selected</div>
              <div className="mt-2 text-sm text-gray-500">
                Select a lead from the queue to work outreach, follow-up, and conversion.
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickViewButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
        props.active
          ? "border-black bg-black text-white"
          : "border-black/10 bg-white text-gray-900 hover:bg-gray-50"
      }`}
    >
      {props.label}
    </button>
  );
}

function FieldInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-500">{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
        placeholder={props.placeholder}
      />
    </div>
  );
}

function FieldSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-500">{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
      >
        {props.options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldTextarea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-500">{props.label}</div>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={props.rows}
        className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm"
        placeholder={props.placeholder}
      />
    </div>
  );
}

function InfoCard(props: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <div className="text-xs font-semibold text-gray-500">{props.title}</div>
      <div className="mt-2 text-sm text-gray-900">{props.value}</div>
    </div>
  );
}

function TextCard(props: { title: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <div className="text-xs font-semibold text-gray-500">{props.title}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
        {props.value || "No content yet."}
      </div>
    </div>
  );
}