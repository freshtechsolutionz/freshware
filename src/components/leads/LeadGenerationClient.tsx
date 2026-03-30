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

type SavedViewKey =
  | "all"
  | "score_80_plus"
  | "directory_leads"
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

function humanizeService(value: string | null | undefined) {
  const v = String(value || "").trim();
  if (!v) return "N/A";
  return v
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function titleForMode(mode: ModeValue) {
  if (mode === "ideal_customer") return "Ideal Customer Search";
  if (mode === "similar_to_company") return "Similar to an Existing Company";
  if (mode === "likely_needs") return "Find Companies with Likely Needs";
  if (mode === "specific_company") return "Analyze a Specific Company";
  return "Source from Business Lists";
}

function isThisWeek(value: string | null | undefined) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);
  return d >= weekAgo;
}

function isFollowUpDue(value: string | null | undefined) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function hasLeadContact(lead: any) {
  return (
    Boolean(lead.contact_email) ||
    Boolean(lead.contact_phone) ||
    toArray(lead.discovered_emails).length > 0 ||
    toArray(lead.discovered_phones).length > 0
  );
}

function hasDraft(lead: any) {
  return Boolean(lead.outreach_subject) || Boolean(lead.outreach_draft);
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
  const [specificCompanyName, setSpecificCompanyName] = useState("");
  const [specificCompanyWebsite, setSpecificCompanyWebsite] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id || null);
  const [workingLeadId, setWorkingLeadId] = useState<string | null>(null);
  const [updatingOutreach, setUpdatingOutreach] = useState(false);
  const [replySaving, setReplySaving] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);

  const [outreachNotes, setOutreachNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("NONE");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachDraft, setOutreachDraft] = useState("");

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [sourceLabelFilter, setSourceLabelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"all" | "80_plus">("all");
  const [savedView, setSavedView] = useState<SavedViewKey>("all");

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2600);
    return () => clearTimeout(t);
  }, [success]);

  const uniqueSourceLabels = useMemo(() => {
    return Array.from(
      new Set(
        leads
          .map((lead) => String(lead.source_label || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "all" && String(lead.status || "") !== statusFilter) return false;
      if (serviceFilter !== "all" && String(lead.recommended_service_line || "") !== serviceFilter) return false;
      if (sourceTypeFilter !== "all" && String(lead.source_type || "") !== sourceTypeFilter) return false;
      if (sourceLabelFilter !== "all" && String(lead.source_label || "") !== sourceLabelFilter) return false;
      if (scoreFilter === "80_plus" && Number(lead.total_score || 0) < 80) return false;

      const contactFound = hasLeadContact(lead);
      const draftFound = hasDraft(lead);
      const notContacted = String(lead.outreach_status || "NOT_CONTACTED") === "NOT_CONTACTED";
      const lastStatus = String(lead.last_outreach_status || "NONE").toUpperCase();
      const outreachStatus = String(lead.outreach_status || "").toUpperCase();

      if (savedView === "score_80_plus" && Number(lead.total_score || 0) < 80) return false;
      if (savedView === "directory_leads" && String(lead.source_type || "") !== "directory") return false;
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
      if (savedView === "ready_to_email" && !(contactFound && notContacted && Number(lead.total_score || 0) >= 70)) return false;
      if (savedView === "high_score_uncontacted" && !(notContacted && Number(lead.total_score || 0) >= 80)) return false;
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
        ...(toArray(lead.discovered_emails)),
        ...(toArray(lead.discovered_phones)),
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
    leads,
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
    leads.find((lead) => lead.id === selectedLeadId) ||
    filteredLeads[0] ||
    null;

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

  const directoryLeadCount = useMemo(
    () => leads.filter((lead) => String(lead.source_type || "") === "directory").length,
    [leads]
  );

  const contactFoundCount = useMemo(
    () => leads.filter((lead) => hasLeadContact(lead)).length,
    [leads]
  );

  const followUpDueCount = useMemo(
    () => leads.filter((lead) => isFollowUpDue(lead.next_follow_up_at)).length,
    [leads]
  );

  const readyToEmailCount = useMemo(
    () =>
      leads.filter((lead) => {
        return hasLeadContact(lead) &&
          String(lead.outreach_status || "NOT_CONTACTED") === "NOT_CONTACTED" &&
          Number(lead.total_score || 0) >= 70;
      }).length,
    [leads]
  );

  const draftReadyCount = useMemo(
    () => leads.filter((lead) => hasDraft(lead)).length,
    [leads]
  );

  const sentCount = useMemo(
    () =>
      leads.filter((lead) => {
        const status = String(lead.last_outreach_status || "").toUpperCase();
        return status === "SENT" || status === "SENT_MANUAL";
      }).length,
    [leads]
  );

  const manualSendRequiredCount = useMemo(
    () =>
      leads.filter((lead) => String(lead.last_outreach_status || "").toUpperCase() === "MANUAL_SEND_REQUIRED").length,
    [leads]
  );

  const respondedCount = useMemo(
    () => leads.filter((lead) => String(lead.outreach_status || "").toUpperCase() === "RESPONDED").length,
    [leads]
  );

  const topSources = useMemo(() => {
    const counts: Record<string, { count: number; scoreTotal: number }> = {};
    for (const lead of leads) {
      const label = String(lead.source_label || lead.source_type || "Unknown");
      if (!counts[label]) counts[label] = { count: 0, scoreTotal: 0 };
      counts[label].count += 1;
      counts[label].scoreTotal += Number(lead.total_score || 0);
    }

    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        count: value.count,
        avgScore: value.count ? Math.round(value.scoreTotal / value.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [leads]);

  const bestLeadsThisWeek = useMemo(() => {
    return leads
      .filter((lead) => isThisWeek(lead.created_at))
      .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
      .slice(0, 5);
  }, [leads]);

  const followUpQueue = useMemo(() => {
    return leads
      .filter((lead) => isFollowUpDue(lead.next_follow_up_at))
      .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
      .slice(0, 6);
  }, [leads]);

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
          : mode === "likely_needs"
          ? "needs_based"
          : mode === "specific_company"
          ? "specific_company"
          : "business_lists";

      const builtCandidateInput =
        mode === "specific_company"
          ? [specificCompanyName, specificCompanyWebsite].filter(Boolean).join(" | ")
          : candidateInput;

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
          candidateInput: builtCandidateInput,
          lookalikeCompanyId: mode === "similar_to_company" ? lookalikeCompanyId : "",
          specificCompanyName,
          specificCompanyWebsite,
          sourceLabel,
          sourceUrl,
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

  async function generateOutreach() {
    if (!selectedLead?.id) return;

    try {
      setGeneratingOutreach(true);
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
      setGeneratingOutreach(false);
    }
  }

  async function generateFollowup() {
    if (!selectedLead?.id) return;

    try {
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/generate-followup`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate follow-up");
      }

      setSuccess("Follow-up draft generated.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to generate follow-up");
    }
  }

  async function sendOutreach() {
    if (!selectedLead?.id) return;

    try {
      setSendingOutreach(true);
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
        setSuccess("Email app opened. After sending, click Mark Email Sent.");
      } else {
        setSuccess("Outreach email sent.");
      }

      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to send outreach");
    } finally {
      setSendingOutreach(false);
    }
  }

  async function markOutreachSent() {
    if (!selectedLead?.id) return;

    try {
      setMarkingSent(true);
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

      setSuccess("Manual send logged.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to mark email sent");
    } finally {
      setMarkingSent(false);
    }
  }

  async function updateFollowUp() {
    if (!selectedLead?.id) return;

    try {
      setUpdatingFollowUp(true);
      setError("");
      setSuccess("");

      const payload = {
        next_follow_up_at: followUpDate ? new Date(`${followUpDate}T12:00:00`).toISOString() : null,
        follow_up_status: followUpStatus,
        follow_up_notes: followUpNotes,
      };

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/update-follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setUpdatingFollowUp(false);
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

  async function updateOutreach(status: string) {
    if (!selectedLead?.id) return;

    try {
      setUpdatingOutreach(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/lead-prospects/${selectedLead.id}/update-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes: outreachNotes,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update outreach");
      }

      setSuccess("Outreach updated.");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Failed to update outreach");
    } finally {
      setUpdatingOutreach(false);
    }
  }

  async function saveReply() {
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

      setReplyOpen(false);
      setReplyMessage("");
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

              <FieldInput label="Service Focus" value={serviceFocus} onChange={setServiceFocus} placeholder="website, mobile_app, software, ai, support, consulting" />
              <FieldInput label="Geography" value={geography} onChange={setGeography} placeholder="Houston, Texas, nationwide" />

              {showIdealCustomerFields ? (
                <>
                  <FieldInput label="Industries" value={industries} onChange={setIndustries} placeholder="churches, chambers, healthcare, nonprofits" />
                  <FieldInput label="Company Size" value={companySizes} onChange={setCompanySizes} placeholder="SMB, mid-market, 10-200 employees" />
                  <FieldInput label="Buyer Titles" value={buyerTitles} onChange={setBuyerTitles} placeholder="CEO, Founder, COO, Operations Manager" />
                </>
              ) : null}

              {showLookalikeFields ? (
                <>
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
                  <FieldInput label="Industries" value={industries} onChange={setIndustries} placeholder="Optional override industry" />
                </>
              ) : null}

              {showNeedsFields ? (
                <FieldInput label="Industries" value={industries} onChange={setIndustries} placeholder="churches, chambers, healthcare, nonprofits" />
              ) : null}

              {showSpecificFields ? (
                <>
                  <FieldInput label="Exact Company Name" value={specificCompanyName} onChange={setSpecificCompanyName} placeholder="Houston Medical Billing Solutions" />
                  <FieldInput label="Website or Domain" value={specificCompanyWebsite} onChange={setSpecificCompanyWebsite} placeholder="houstonmbs.com" />
                </>
              ) : null}

              {showBusinessListFields ? (
                <>
                  <FieldInput label="Source Label" value={sourceLabel} onChange={setSourceLabel} placeholder="Greater Houston Black Chamber, Houston Business Directory, Google Maps Export" />
                  <FieldInput label="Source URL" value={sourceUrl} onChange={setSourceUrl} placeholder="https://example.com/member-directory" />
                </>
              ) : null}

              <FieldTextarea
                label="Notes to AI"
                value={notes}
                onChange={setNotes}
                rows={4}
                placeholder="Prioritize weak digital presence, recurring customer engagement, manual workflows, or signs they need automation."
              />

              {!showSpecificFields ? (
                <FieldTextarea
                  label={showBusinessListFields ? "Paste Business List / Directory Blocks" : "Candidate Companies / Websites / Directory Rows"}
                  value={candidateInput}
                  onChange={setCandidateInput}
                  rows={showBusinessListFields ? 14 : 10}
                  placeholder={
                    showBusinessListFields
                      ? `Paste copied business listings. Example:

Greater Houston Black Chamber
https://example.org
Houston, TX
info@example.org
(713) 555-1212

Maple Tree Kids Daycare
https://mapletree.com
Rosenberg, TX
info@mapletree.com
`
                      : `Paste one per line.

Examples:
ABC Medical Billing | abcbilling.com | Houston TX
Greater Heights Chamber | ghc.org | Houston
Maple Tree Kids Daycare | Rosenberg TX | daycare
company.com`
                  }
                />
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generateLeads}
                  disabled={submitting}
                  className="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Generating..." : "Generate Lead Prospects"}
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
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-gray-900">CSV / Directory Import</div>
            <div className="mt-1 text-sm text-gray-500">
              Paste CSV rows or copied business directory data directly into Freshware.
            </div>

            <div className="mt-5 space-y-4">
              <FieldInput
                label="Import Source"
                value={importSource}
                onChange={setImportSource}
                placeholder="directory_import"
              />

              <FieldTextarea
                label="CSV / Copied Rows"
                value={csvText}
                onChange={setCsvText}
                rows={10}
                placeholder={`company_name,website,city,state,industry,email
ABC Medical Billing,abcbilling.com,Houston,TX,Healthcare,info@abcbilling.com`}
              />

              <button
                type="button"
                onClick={importCsv}
                disabled={importing}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importing ? "Importing..." : "Import Leads"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-gray-900">Saved Views</div>
            <div className="mt-1 text-sm text-gray-500">
              One-click sourcing and outbound views for fast execution.
            </div>

            <div className="mt-5 grid gap-2">
              <SavedViewButton label="All Leads" active={savedView === "all"} onClick={() => setSavedView("all")} />
              <SavedViewButton label="80+ Leads" active={savedView === "score_80_plus"} onClick={() => setSavedView("score_80_plus")} />
              <SavedViewButton label="Ready to Email" active={savedView === "ready_to_email"} onClick={() => setSavedView("ready_to_email")} />
              <SavedViewButton label="High Score Uncontacted" active={savedView === "high_score_uncontacted"} onClick={() => setSavedView("high_score_uncontacted")} />
              <SavedViewButton label="Draft Ready" active={savedView === "draft_ready"} onClick={() => setSavedView("draft_ready")} />
              <SavedViewButton label="Sent" active={savedView === "sent"} onClick={() => setSavedView("sent")} />
              <SavedViewButton label="Manual Send Required" active={savedView === "manual_send_required"} onClick={() => setSavedView("manual_send_required")} />
              <SavedViewButton label="Responded" active={savedView === "responded"} onClick={() => setSavedView("responded")} />
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-gray-900">Website Discovery</div>
            <div className="mt-1 text-sm text-gray-500">
              Analyze imported lead websites in batch to detect digital maturity and likely service needs.
            </div>

            <div className="mt-5 space-y-3 text-sm text-gray-600">
              <div>Leads with websites: {leadsWithWebsites.length}</div>
              <div>Analyzed leads: {analyzedCount}</div>
              <div>Leads with contact info found: {contactFoundCount}</div>
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
          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-gray-900">CEO Sourcing Intelligence</div>
            <div className="mt-1 text-sm text-gray-500">
              See which channels are producing the strongest prospects and who needs action next.
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Total Leads" value={String(leads.length)} />
              <MetricCard label="80+ Leads" value={String(score80Count)} />
              <MetricCard label="Directory Leads" value={String(directoryLeadCount)} />
              <MetricCard label="Contacts Found" value={String(contactFoundCount)} />
              <MetricCard label="Ready to Email" value={String(readyToEmailCount)} />
              <MetricCard label="Follow-Up Due" value={String(followUpDueCount)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Draft Ready" value={String(draftReadyCount)} />
              <MetricCard label="Sent" value={String(sentCount)} />
              <MetricCard label="Manual Send Required" value={String(manualSendRequiredCount)} />
              <MetricCard label="Responded" value={String(respondedCount)} />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold text-gray-900">Top Source Channels</div>
                <div className="mt-3 space-y-3">
                  {topSources.length ? (
                    topSources.map((source) => (
                      <div key={source.label} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 p-3">
                        <div>
                          <div className="font-semibold text-gray-900">{source.label}</div>
                          <div className="text-xs text-gray-500">Avg score: {source.avgScore}</div>
                        </div>
                        <div className="text-lg font-semibold text-gray-900">{source.count}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No source data yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold text-gray-900">Best Leads This Week</div>
                <div className="mt-3 space-y-3">
                  {bestLeadsThisWeek.length ? (
                    bestLeadsThisWeek.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 p-3 text-left hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{lead.company_name}</div>
                          <div className="text-xs text-gray-500">{lead.source_label || lead.source_type || "Unknown source"}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${scoreChipClass(lead.total_score)}`}>
                          {lead.total_score ?? "N/A"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No new leads this week yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold text-gray-900">Follow-Up Queue</div>
                <div className="mt-3 space-y-3">
                  {followUpQueue.length ? (
                    followUpQueue.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 p-3 text-left hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{lead.company_name}</div>
                          <div className="text-xs text-gray-500">
                            Due: {lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleDateString() : "N/A"}
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${scoreChipClass(lead.total_score)}`}>
                          {lead.total_score ?? "N/A"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No follow-ups due.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xl font-semibold text-gray-900">Lead Results</div>
                <div className="mt-1 text-sm text-gray-500">
                  Score, enrich, qualify, convert, send, and track outreach.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <FieldInput label="Search" value={search} onChange={setSearch} placeholder="Search leads" />
                <FieldSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "All" }, { value: "new", label: "New" }, { value: "converted_company", label: "Converted to Company" }, { value: "converted_opportunity", label: "Converted to Opportunity" }]} />
                <FieldSelect label="Service" value={serviceFilter} onChange={setServiceFilter} options={[{ value: "all", label: "All" }, { value: "website", label: "Website" }, { value: "mobile_app", label: "Mobile App" }, { value: "software", label: "Software" }, { value: "ai", label: "AI" }, { value: "support", label: "Support" }, { value: "consulting", label: "Consulting" }]} />
                <FieldSelect label="Source Type" value={sourceTypeFilter} onChange={setSourceTypeFilter} options={[{ value: "all", label: "All" }, { value: "manual", label: "Manual" }, { value: "directory", label: "Directory" }, { value: "csv", label: "CSV" }]} />
                <FieldSelect label="Source Label" value={sourceLabelFilter} onChange={setSourceLabelFilter} options={[{ value: "all", label: "All" }, ...uniqueSourceLabels.map((label) => ({ value: label, label }))]} />
              </div>
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <div className="overflow-hidden rounded-2xl border border-black/10">
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
                              <div className="font-semibold text-gray-900">{lead.company_name}</div>
                              <div className="text-xs text-gray-500">
                                {pretty(lead.industry)}
                                {lead.city || lead.state ? ` • ${[lead.city, lead.state].filter(Boolean).join(", ")}` : ""}
                              </div>
                              {lead.website ? <div className="mt-1 break-all text-xs text-blue-700">{lead.website}</div> : null}
                              {lead.source_label ? (
                                <div className="mt-1 text-[11px] text-gray-400">
                                  {lead.source_label}
                                  {lead.source_type ? ` • ${lead.source_type}` : ""}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 align-top">{pretty(lead.detected_need)}</td>
                            <td className="px-4 py-3 align-top">{humanizeService(lead.recommended_service_line)}</td>
                            <td className="px-4 py-3 align-top">
                              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${scoreChipClass(lead.total_score)}`}>
                                {lead.total_score ?? "N/A"}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div>{pretty(lead.outreach_status || lead.status)}</div>
                              {lead.last_outreach_status ? (
                                <div className="text-[11px] text-gray-500">
                                  Last send: {lead.last_outreach_status}
                                </div>
                              ) : null}
                              {lead.next_follow_up_at ? (
                                <div className="text-[11px] text-gray-500">
                                  Follow-up: {new Date(lead.next_follow_up_at).toLocaleDateString()}
                                </div>
                              ) : null}
                            </td>
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
                <div className="rounded-2xl border border-black/10 bg-white p-5">
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
                      <InfoBlock title="Recommended Service" value={humanizeService(selectedLead.recommended_service_line)} />
                      <InfoBlock title="AI Summary" value={selectedLead.ai_summary} />
                      <InfoBlock title="AI Reasoning" value={selectedLead.ai_reasoning} />
                      <InfoBlock title="Outreach Angle" value={selectedLead.outreach_angle} />
                      <InfoBlock title="Source" value={selectedLead.source_label || selectedLead.source_type} />
                      <InfoBlock title="Source URL" value={selectedLead.source_url} />
                      <WebsiteAnalysisBlock data={selectedLead.website_analysis} />

                      <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contact Intelligence</div>
                        <div className="mt-3 space-y-2 text-sm text-gray-700">
                          <div><b>Primary Email:</b> {selectedLead.contact_email || "N/A"}</div>
                          <div><b>Primary Phone:</b> {selectedLead.contact_phone || "N/A"}</div>
                          <div><b>Contact Page:</b> {selectedLead.contact_page_url || "N/A"}</div>
                          <div><b>Discovered Emails:</b> {discoveredEmails.length ? discoveredEmails.join(", ") : "N/A"}</div>
                          <div><b>Discovered Phones:</b> {discoveredPhones.length ? discoveredPhones.join(", ") : "N/A"}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <ScoreCard label="Fit" value={selectedLead.fit_score} />
                        <ScoreCard label="Need" value={selectedLead.need_score} />
                        <ScoreCard label="Urgency" value={selectedLead.urgency_score} />
                        <ScoreCard label="Access" value={selectedLead.access_score} />
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Outreach Composer
                          </div>
                          <button
                            type="button"
                            onClick={generateOutreach}
                            disabled={generatingOutreach}
                            className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                          >
                            {generatingOutreach ? "Generating..." : "Generate Draft"}
                          </button>
                        </div>

                        <div className="mt-3 space-y-3 text-sm">
                          <div>
                            <div className="mb-1 text-xs font-semibold text-gray-500">Recipient</div>
                            <input
                              value={recipientEmail}
                              onChange={(e) => setRecipientEmail(e.target.value)}
                              className="w-full rounded-xl border border-black/10 px-3 py-2"
                              placeholder="recipient@company.com"
                            />
                          </div>

                          <div>
                            <div className="mb-1 text-xs font-semibold text-gray-500">Subject</div>
                            <input
                              value={outreachSubject}
                              onChange={(e) => setOutreachSubject(e.target.value)}
                              className="w-full rounded-xl border border-black/10 px-3 py-2"
                              placeholder="Email subject"
                            />
                          </div>

                          <div>
                            <div className="mb-1 text-xs font-semibold text-gray-500">Draft</div>
                            <textarea
                              value={outreachDraft}
                              onChange={(e) => setOutreachDraft(e.target.value)}
                              rows={8}
                              className="w-full rounded-xl border border-black/10 px-3 py-2"
                              placeholder="Write or generate outreach draft..."
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={generateFollowup}
                              className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                            >
                              Generate Follow-Up
                            </button>

                            <button
                              type="button"
                              onClick={sendOutreach}
                              disabled={sendingOutreach}
                              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {sendingOutreach ? "Sending..." : "Send Email"}
                            </button>

                            <button
                              type="button"
                              onClick={markOutreachSent}
                              disabled={markingSent}
                              className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                            >
                              {markingSent ? "Saving..." : "Mark Email Sent"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Reply + Outcome
                          </div>

                          <button
                            type="button"
                            onClick={() => setReplyOpen(true)}
                            className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
                          >
                            Log Reply
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          <textarea
                            value={outcomeNotes}
                            onChange={(e) => setOutcomeNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                            placeholder="Outcome notes, lessons learned, conversion notes..."
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => markOutcome("WON")}
                              disabled={outcomeSaving}
                              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Mark Won
                            </button>

                            <button
                              type="button"
                              onClick={() => markOutcome("LOST")}
                              disabled={outcomeSaving}
                              className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                            >
                              Mark Lost
                            </button>

                            <button
                              type="button"
                              onClick={() => markOutcome("NO_RESPONSE")}
                              disabled={outcomeSaving}
                              className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                            >
                              Mark No Response
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Outreach Tracking
                        </div>
                        <textarea
                          value={outreachNotes}
                          onChange={(e) => setOutreachNotes(e.target.value)}
                          rows={4}
                          placeholder="Add outreach notes, follow-up context, and response details..."
                          className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-gray-400"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["NOT_CONTACTED", "CONTACTED", "RESPONDED", "CLOSED"].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateOutreach(s)}
                              disabled={updatingOutreach}
                              className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Follow-Up Engine
                        </div>

                        <div className="mt-3 grid gap-3">
                          <div>
                            <div className="mb-1 text-xs font-semibold text-gray-500">Next Follow-Up Date</div>
                            <input
                              type="date"
                              value={followUpDate}
                              onChange={(e) => setFollowUpDate(e.target.value)}
                              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                            />
                          </div>

                          <div>
                            <div className="mb-1 text-xs font-semibold text-gray-500">Follow-Up Status</div>
                            <select
                              value={followUpStatus}
                              onChange={(e) => setFollowUpStatus(e.target.value)}
                              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                            >
                              <option value="NONE">NONE</option>
                              <option value="SCHEDULED">SCHEDULED</option>
                              <option value="DUE">DUE</option>
                              <option value="COMPLETED">COMPLETED</option>
                              <option value="PAUSED">PAUSED</option>
                            </select>
                          </div>

                          <div>
                            <div className="mb-1 text-xs font-semibold text-gray-500">Follow-Up Notes</div>
                            <textarea
                              value={followUpNotes}
                              onChange={(e) => setFollowUpNotes(e.target.value)}
                              rows={3}
                              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                              placeholder="Why this follow-up matters, what to say next, what happened last time..."
                            />
                          </div>

                          <button
                            type="button"
                            onClick={updateFollowUp}
                            disabled={updatingFollowUp}
                            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {updatingFollowUp ? "Saving..." : "Save Follow-Up"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Outreach History
                        </div>

                        <div className="mt-3 space-y-3">
                          {loadingEvents ? (
                            <div className="text-sm text-gray-500">Loading history...</div>
                          ) : events.length ? (
                            events.map((event) => (
                              <div key={event.id} className="rounded-xl border border-black/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {event.event_type || "event"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {event.created_at ? new Date(event.created_at).toLocaleString() : ""}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-gray-600">
                                  {event.delivery_status || "N/A"}{event.provider ? ` • ${event.provider}` : ""}
                                </div>
                                {event.recipient_email ? (
                                  <div className="mt-1 text-xs text-gray-600">To: {event.recipient_email}</div>
                                ) : null}
                                {event.subject ? (
                                  <div className="mt-1 text-xs text-gray-600">Subject: {event.subject}</div>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No outreach history yet.</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedLead.converted_company_id ? (
                          <Link href={`/dashboard/companies/${selectedLead.converted_company_id}`} className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white">
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
                          <Link href={`/dashboard/opportunities/${selectedLead.converted_opportunity_id}`} className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white">
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

          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-gray-900">Lead Performance Overview</div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <MetricButton label="Total Leads" value={String(leads.length)} active={savedView === "all" && scoreFilter === "all"} onClick={() => { setSavedView("all"); setScoreFilter("all"); }} />
              <MetricCard label="With Websites" value={String(leadsWithWebsites.length)} />
              <MetricCard label="Analyzed" value={String(analyzedCount)} />
              <MetricButton label="80+ Score" value={String(score80Count)} active={savedView === "score_80_plus" || scoreFilter === "80_plus"} onClick={() => { setSavedView("score_80_plus"); setScoreFilter("80_plus"); }} />
              <MetricButton label="Ready to Email" value={String(readyToEmailCount)} active={savedView === "ready_to_email"} onClick={() => setSavedView("ready_to_email")} />
              <MetricButton label="Follow-Up Due" value={String(followUpDueCount)} active={savedView === "follow_up_due"} onClick={() => setSavedView("follow_up_due")} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <MetricButton label="Draft Ready" value={String(draftReadyCount)} active={savedView === "draft_ready"} onClick={() => setSavedView("draft_ready")} />
              <MetricButton label="Sent" value={String(sentCount)} active={savedView === "sent"} onClick={() => setSavedView("sent")} />
              <MetricButton label="Manual Send Required" value={String(manualSendRequiredCount)} active={savedView === "manual_send_required"} onClick={() => setSavedView("manual_send_required")} />
              <MetricButton label="Responded" value={String(respondedCount)} active={savedView === "responded"} onClick={() => setSavedView("responded")} />
              <MetricButton label="Contact Found" value={String(contactFoundCount)} active={savedView === "contact_found"} onClick={() => setSavedView("contact_found")} />
              <MetricButton label="Converted" value={String(filteredLeads.filter((lead) => lead.converted_company_id || lead.converted_opportunity_id).length)} active={savedView === "converted"} onClick={() => setSavedView("converted")} />
            </div>
          </section>
        </div>
      </div>

      {replyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold text-gray-900">Log Reply</div>
            <div className="mt-1 text-sm text-gray-500">
              Capture the reply so Freshware knows this lead is engaged.
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 text-sm font-semibold text-gray-900">Sender Email</div>
                <input
                  value={replyEmail}
                  onChange={(e) => setReplyEmail(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  placeholder="person@company.com"
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-gray-900">Reply Message</div>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  placeholder="Paste the inbound reply here..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplyOpen(false)}
                  className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveReply}
                  disabled={replySaving}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {replySaving ? "Saving..." : "Save Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SavedViewButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
        active ? "border-black bg-black text-white" : "border-black/10 bg-white text-gray-900 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
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
        className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-gray-400"
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
        className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-gray-400"
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
        className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-gray-400"
      />
    </div>
  );
}

function InfoBlock({
  title,
  value,
  strong,
}: {
  title: string;
  value: string | null | undefined;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div className={`mt-2 break-words text-sm text-gray-700 ${strong ? "text-2xl font-semibold text-gray-900" : ""}`}>
        {value || "N/A"}
      </div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value ?? "N/A"}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
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
        active ? "bg-black text-white border-black" : "bg-white border-black/10 hover:bg-gray-50"
      }`}
    >
      <div className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-white/80" : "text-gray-500"}`}>
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${active ? "text-white" : "text-gray-900"}`}>{value}</div>
    </button>
  );
}

function WebsiteAnalysisBlock({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Website Intelligence
        </div>
        <div className="mt-2 text-sm text-gray-500">Not analyzed yet.</div>
      </div>
    );
  }

  const signals = data.detected_signals || {};
  const insights: string[] = Array.isArray(data.insights)
    ? data.insights
    : Array.isArray(data.summary_points)
    ? data.summary_points
    : [];
  const opportunities: string[] = Array.isArray(data.opportunities) ? data.opportunities : [];

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Website Intelligence
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="HTTPS" value={signals.hasHttps ? "Yes" : "No"} />
        <MiniStat label="Booking System" value={signals.hasBooking ? "Yes" : "No"} />
        <MiniStat label="Ecommerce" value={signals.hasEcommerce ? "Yes" : "No"} />
        <MiniStat label="Contact Form" value={signals.hasContactForm ? "Yes" : "No"} />
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500">Digital Maturity</div>
        <div className="mt-1 text-sm font-semibold text-gray-900">
          {pretty(data.digital_maturity)}
        </div>
      </div>

      {insights.length ? (
        <div>
          <div className="text-xs font-semibold text-gray-500">Key Insights</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {insights.map((item, idx) => (
              <li key={idx} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {opportunities.length ? (
        <div>
          <div className="text-xs font-semibold text-gray-500">Opportunities</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {opportunities.map((item, idx) => (
              <li key={idx} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}