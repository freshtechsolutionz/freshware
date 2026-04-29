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
  | "responded"
  | "has_ios_app"
  | "has_android_app"
  | "no_app_found";

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
}

function pretty(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "N/A";
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
      return "Find Ideal Customers";
    case "similar_to_company":
      return "Find Lookalike Companies";
    case "likely_needs":
      return "Find Companies With Likely Needs";
    case "specific_company":
      return "Research One Company";
    case "business_lists":
      return "Import From Business Lists";
    default:
      return "Lead Generation";
  }
}

function helpForMode(mode: ModeValue) {
  switch (mode) {
    case "ideal_customer":
      return "Use this when you know the type of company, industry, location, and buyer you want.";
    case "similar_to_company":
      return "Use this when you want more companies like one already saved in Freshware.";
    case "likely_needs":
      return "Use this when you want companies that show signs they need websites, apps, AI, automation, or support.";
    case "specific_company":
      return "Use this when you already know the company and want Freshware to research it.";
    case "business_lists":
      return "Use this when you have copied listings from a chamber, directory, association, or business list.";
    default:
      return "Choose the best lead sourcing workflow.";
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

function appStatusLabel(lead: LeadRow | null | undefined) {
  if (!lead) return "N/A";
  if (lead.has_ios_app && lead.has_android_app) return "iOS + Android app found";
  if (lead.has_ios_app) return "iOS app found";
  if (lead.has_android_app) return "Android app found";
  if (lead.app_store_checked_at) return "No app found";
  return "Not checked yet";
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

  const [serviceFocus, setServiceFocus] = useState("mobile_app");
  const [geography, setGeography] = useState("Houston, Texas");
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
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

      if (sourceLabelFilter !== "all" && String(lead.source_label || "") !== sourceLabelFilter) {
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
      if (savedView === "has_ios_app" && !lead.has_ios_app) return false;
      if (savedView === "has_android_app" && !lead.has_android_app) return false;
      if (savedView === "no_app_found" && (lead.has_ios_app || lead.has_android_app || !lead.app_store_checked_at)) return false;

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
        lead.apple_app_store_url,
        lead.google_play_url,
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
    const selectedLead = useMemo(() => {
    return filteredLeads.find((lead) => String(lead.id) === selectedLeadId) || null;
  }, [filteredLeads, selectedLeadId]);

  useEffect(() => {
    if (!filteredLeads.length) {
      setSelectedLeadId("");
      return;
    }

    if (!selectedLeadId) {
      setSelectedLeadId(String(filteredLeads[0].id));
      return;
    }

    const exists = filteredLeads.some((lead) => String(lead.id) === selectedLeadId);

    if (!exists) {
      setSelectedLeadId(String(filteredLeads[0].id));
    }
  }, [filteredLeads, selectedLeadId]);

  useEffect(() => {
    if (!selectedLead) return;

    setRecipientEmail(
      selectedLead.preferred_outreach_email ||
        selectedLead.contact_email ||
        toArray(selectedLead.discovered_emails)[0] ||
        ""
    );

    setOutreachSubject(selectedLead.outreach_subject || "");
    setOutreachDraft(selectedLead.outreach_draft || "");
    setOutreachNotes(selectedLead.outreach_notes || "");

    setFollowUpDate(toDateInputValue(selectedLead.next_follow_up_at));
    setFollowUpStatus(selectedLead.follow_up_status || "NONE");
    setFollowUpNotes(selectedLead.follow_up_notes || "");

    setOutcomeNotes(selectedLead.source_feedback_notes || "");
  }, [selectedLead]);

  useEffect(() => {
    if (!selectedLeadId) return;

    let cancelled = false;

    async function loadEvents() {
      try {
        setLoadingEvents(true);

        const res = await fetch(
          `/api/lead-prospects/${selectedLeadId}/outreach-events`,
          {
            cache: "no-store",
          }
        );

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load outreach events.");
        }

        if (!cancelled) {
          setEvents(Array.isArray(json?.events) ? json.events : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error(err);
        }
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [selectedLeadId]);

  async function refreshPage() {
    window.location.reload();
  }

  async function handleFindLeads() {
    try {
      setSubmitting(true);
      setSuccess("");
      setError("");

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Lead generation failed.");
      }

      setSuccess(`Successfully generated ${json?.count || 0} leads.`);
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Lead generation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnalyzeLeads() {
    try {
      setAnalyzing(true);
      setSuccess("");
      setError("");

      const res = await fetch("/api/lead-prospects/analyze-websites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: Number(analyzeLimit || 25),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Website analysis failed.");
      }

      setSuccess(`Successfully analyzed ${json?.analyzed || 0} leads.`);
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Website analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImportCsv() {
    try {
      setImporting(true);
      setSuccess("");
      setError("");

      const res = await fetch("/api/lead-prospects/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvText,
          sourceType: importSource,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "CSV import failed.");
      }

      setSuccess(`Successfully imported ${json?.count || 0} leads.`);
      setCsvText("");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "CSV import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteLead(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this lead?"
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setSuccess("");
      setError("");

      const res = await fetch(`/api/lead-prospects/${id}/delete`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Delete failed.");
      }

      setSuccess("Lead deleted successfully.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDeleteVisible() {
    if (!filteredLeads.length) return;

    const confirmed = window.confirm(
      `Delete all ${filteredLeads.length} visible leads? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      setSuccess("");
      setError("");

      const res = await fetch("/api/lead-prospects/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: filteredLeads.map((lead) => String(lead.id)),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Bulk delete failed.");
      }

      setSuccess(`Deleted ${json?.deleted_count || 0} leads.`);
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Bulk delete failed.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleGenerateOutreach() {
    if (!selectedLead) return;

    try {
      setOutreachSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/generate-outreach`,
        {
          method: "POST",
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate outreach.");
      }

      setSuccess("Outreach draft generated.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to generate outreach.");
    } finally {
      setOutreachSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedLead) return;

    try {
      setDraftSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/update-outreach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            outreach_subject: outreachSubject,
            outreach_draft: outreachDraft,
            outreach_notes: outreachNotes,
            preferred_outreach_email: recipientEmail,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save draft.");
      }

      setSuccess("Draft saved.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to save draft.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleScheduleFollowUp() {
    if (!selectedLead) return;

    try {
      setFollowUpSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/update-follow-up`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            next_follow_up_at: followUpDate || null,
            follow_up_status: followUpStatus,
            follow_up_notes: followUpNotes,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save follow-up.");
      }

      setSuccess("Follow-up updated.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to save follow-up.");
    } finally {
      setFollowUpSaving(false);
    }
  }
    async function handleSendOutreach() {
    if (!selectedLead) return;

    try {
      setSendSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/send-outreach`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientEmail,
            outreachSubject,
            outreachDraft,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send outreach.");
      }

      setSuccess("Outreach email sent.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to send outreach.");
    } finally {
      setSendSaving(false);
    }
  }

  async function handleMarkManualSent() {
    if (!selectedLead) return;

    try {
      setManualSentSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/mark-outreach-sent`,
        {
          method: "POST",
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to mark outreach.");
      }

      setSuccess("Lead marked as manually contacted.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to mark outreach.");
    } finally {
      setManualSentSaving(false);
    }
  }

  async function handleSaveReply() {
    if (!selectedLead) return;

    try {
      setReplySaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/log-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replyEmail,
            replyMessage,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save reply.");
      }

      setSuccess("Reply saved.");
      setReplyEmail("");
      setReplyMessage("");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to save reply.");
    } finally {
      setReplySaving(false);
    }
  }

  async function handleSaveOutcome(outcome: string) {
    if (!selectedLead) return;

    try {
      setOutcomeSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/mark-outcome`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            outcome,
            notes: outcomeNotes,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save outcome.");
      }

      setSuccess(`Lead marked as ${outcome.toLowerCase()}.`);
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Failed to save outcome.");
    } finally {
      setOutcomeSaving(false);
    }
  }

  async function handleConvertLead() {
    if (!selectedLead) return;

    try {
      setConvertSaving(true);
      setSuccess("");
      setError("");

      const res = await fetch(
        `/api/lead-prospects/${selectedLead.id}/convert`,
        {
          method: "POST",
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Lead conversion failed.");
      }

      setSuccess("Lead converted successfully.");
      await refreshPage();
    } catch (err: any) {
      setError(err?.message || "Lead conversion failed.");
    } finally {
      setConvertSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              AI Lead Intelligence Engine
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Freshware Lead Generation
            </h1>

            <p className="max-w-3xl text-sm leading-6 text-zinc-600">
              Find real businesses, analyze their websites, detect likely technology
              opportunities, discover contact information, identify mobile apps,
              generate outreach, and convert leads into opportunities.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total Leads
              </div>

              <div className="mt-2 text-3xl font-bold text-zinc-900">
                {safeLeads.length}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Filtered Leads
              </div>

              <div className="mt-2 text-3xl font-bold text-zinc-900">
                {filteredLeads.length}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Contact Info Found
              </div>

              <div className="mt-2 text-3xl font-bold text-zinc-900">
                {
                  safeLeads.filter((lead) => hasLeadContact(lead)).length
                }
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Mobile Apps Found
              </div>

              <div className="mt-2 text-3xl font-bold text-zinc-900">
                {
                  safeLeads.filter(
                    (lead) => lead.has_ios_app || lead.has_android_app
                  ).length
                }
              </div>
            </div>
          </div>
        </div>

        {success ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-zinc-900">
                Step 1: Choose Lead Workflow
              </h2>

              <p className="text-sm text-zinc-600">
                Choose the workflow that best matches how you want to discover
                companies.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {([
                "ideal_customer",
                "similar_to_company",
                "likely_needs",
                "specific_company",
                "business_lists",
              ] as ModeValue[]).map((value) => {
                const active = mode === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">
                      {titleForMode(value)}
                    </div>

                    <div
                      className={`mt-1 text-xs leading-5 ${
                        active ? "text-zinc-200" : "text-zinc-500"
                      }`}
                    >
                      {helpForMode(value)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
                    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-zinc-900">
                Step 2: Define Target
              </h2>

              <p className="text-sm text-zinc-600">
                Keep it simple. Industry plus geography is usually enough to start.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <FieldInput
                label="Flagship Service Focus"
                value={serviceFocus}
                onChange={setServiceFocus}
                placeholder="mobile_app, website, software, ai, consulting"
              />

              <FieldInput
                label="Geography"
                value={geography}
                onChange={setGeography}
                placeholder="Houston, Texas"
              />

              {mode !== "specific_company" && mode !== "business_lists" ? (
                <>
                  <FieldInput
                    label="Industries"
                    value={industries}
                    onChange={setIndustries}
                    placeholder="churches, chambers, restaurants, healthcare, nonprofits"
                  />

                  <FieldInput
                    label="Company Size"
                    value={companySizes}
                    onChange={setCompanySizes}
                    placeholder="small business, midsize, enterprise"
                  />

                  <FieldInput
                    label="Buyer Titles"
                    value={buyerTitles}
                    onChange={setBuyerTitles}
                    placeholder="owner, founder, executive director, COO, pastor"
                  />
                </>
              ) : null}

              {mode === "similar_to_company" ? (
                <FieldSelect
                  label="Find companies similar to"
                  value={selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  options={[
                    { value: "", label: "Select a company" },
                    ...safeCompanies.map((company) => ({
                      value: company.id,
                      label: `${company.name || "Unnamed Company"}${
                        company.industry ? ` · ${company.industry}` : ""
                      }`,
                    })),
                  ]}
                />
              ) : null}

              {mode === "specific_company" ? (
                <>
                  <FieldInput
                    label="Company Name"
                    value={companyName}
                    onChange={setCompanyName}
                    placeholder="Company name"
                  />

                  <FieldInput
                    label="Website"
                    value={website}
                    onChange={setWebsite}
                    placeholder="https://example.com"
                  />
                </>
              ) : null}

              {mode === "business_lists" ? (
                <>
                  <FieldInput
                    label="Source Label"
                    value={sourceLabel}
                    onChange={setSourceLabel}
                    placeholder="Houston Chamber Directory"
                  />

                  <FieldInput
                    label="Source URL"
                    value={sourceUrl}
                    onChange={setSourceUrl}
                    placeholder="https://example.com/directory"
                  />

                  <FieldTextarea
                    label="Business Listings"
                    value={candidateInput}
                    onChange={setCandidateInput}
                    rows={8}
                    placeholder={`Paste business listings here.

Example:
Maple Tree Kids Daycare | mapletree.com | info@mapletree.com | Rosenberg, TX`}
                  />
                </>
              ) : null}

              <FieldTextarea
                label="Notes to AI"
                value={notes}
                onChange={setNotes}
                rows={4}
                placeholder="Tell Freshware what to prioritize. Example: find businesses that need mobile apps, booking, client portals, automation, or better customer engagement."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  label="New Leads To Find"
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
                  label="Saved Leads To Research"
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
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-zinc-900">
                Step 3: Run Lead Actions
              </h2>

              <p className="text-sm text-zinc-600">
                Find new companies first, then research saved leads to enrich contact info,
                website intelligence, and app-store presence.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={handleFindLeads}
                disabled={submitting}
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {submitting ? "Finding New Leads..." : "Find New Leads"}
              </button>

              <button
                type="button"
                onClick={handleAnalyzeLeads}
                disabled={analyzing || !safeLeads.length}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                {analyzing
                  ? "Researching Saved Leads..."
                  : `Research Saved Leads (${Math.min(
                      Number(analyzeLimit || 25),
                      safeLeads.length
                    )})`}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                Upload CSV File
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const text = await file.text();
                  setCsvText(text);
                  setSuccess(`Loaded CSV file: ${file.name}`);
                  setError("");
                }}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-zinc-900">
                CSV Import
              </h2>

              <p className="text-sm text-zinc-600">
                Paste or upload a CSV, then import those businesses into the queue.
              </p>
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
                rows={8}
                placeholder={`company_name,website,email,city,state,industry
Maple Tree Kids Daycare,mapletree.com,info@mapletree.com,Rosenberg,TX,Daycare`}
              />

              <button
                type="button"
                onClick={handleImportCsv}
                disabled={importing || !csvText.trim()}
                className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {importing ? "Importing Leads..." : "Import CSV Leads"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-zinc-900">
                Quick Views
              </h2>

              <p className="text-sm text-zinc-600">
                Filter the lead queue by the next action you want to take.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <QuickViewButton label="All" active={savedView === "all"} onClick={() => setSavedView("all")} />
              <QuickViewButton label="Not Contacted" active={savedView === "not_contacted"} onClick={() => setSavedView("not_contacted")} />
              <QuickViewButton label="Contact Found" active={savedView === "contact_found"} onClick={() => setSavedView("contact_found")} />
              <QuickViewButton label="Ready to Email" active={savedView === "ready_to_email"} onClick={() => setSavedView("ready_to_email")} />
              <QuickViewButton label="80+ Score" active={savedView === "high_score_uncontacted"} onClick={() => setSavedView("high_score_uncontacted")} />
              <QuickViewButton label="Analyzed" active={savedView === "analyzed_leads"} onClick={() => setSavedView("analyzed_leads")} />
              <QuickViewButton label="iOS App" active={savedView === "has_ios_app"} onClick={() => setSavedView("has_ios_app")} />
              <QuickViewButton label="Android App" active={savedView === "has_android_app"} onClick={() => setSavedView("has_android_app")} />
              <QuickViewButton label="No App Found" active={savedView === "no_app_found"} onClick={() => setSavedView("no_app_found")} />
              <QuickViewButton label="Follow-Up Due" active={savedView === "follow_up_due"} onClick={() => setSavedView("follow_up_due")} />
              <QuickViewButton label="Draft Ready" active={savedView === "draft_ready"} onClick={() => setSavedView("draft_ready")} />
              <QuickViewButton label="Converted" active={savedView === "converted"} onClick={() => setSavedView("converted")} />
            </div>
          </div>
        </div>
                <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  Step 4: Work the Lead Queue
                </h2>

                <p className="mt-1 text-sm text-zinc-600">
                  Select a lead to review research, contact info, app-store status,
                  outreach, follow-up, and conversion options.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBulkDeleteVisible}
                disabled={bulkDeleting || !filteredLeads.length}
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                {bulkDeleting
                  ? "Deleting..."
                  : `Delete Visible (${filteredLeads.length})`}
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <FieldInput
                label="Search Leads"
                value={search}
                onChange={setSearch}
                placeholder="Company, website, email, app, need"
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
                  { value: "NOT_CONTACTED", label: "Not Contacted" },
                  { value: "CONTACTED", label: "Contacted" },
                  { value: "RESPONDED", label: "Responded" },
                  { value: "CLOSED", label: "Closed" },
                ]}
              />

              <FieldSelect
                label="Service"
                value={serviceFilter}
                onChange={setServiceFilter}
                options={[
                  { value: "all", label: "All Services" },
                  { value: "mobile_app", label: "Mobile App" },
                  { value: "website", label: "Website" },
                  { value: "software", label: "Software" },
                  { value: "ai", label: "AI" },
                  { value: "support", label: "Support" },
                  { value: "consulting", label: "Consulting" },
                ]}
              />

              <FieldSelect
                label="Source Type"
                value={sourceTypeFilter}
                onChange={setSourceTypeFilter}
                options={[
                  { value: "all", label: "All Source Types" },
                  { value: "manual", label: "Manual" },
                  { value: "directory", label: "Directory" },
                  { value: "csv", label: "CSV" },
                  { value: "brave", label: "Brave Search" },
                  { value: "serpapi", label: "SerpAPI" },
                  { value: "bing", label: "Bing Search" },
                  { value: "google_cse", label: "Google Custom Search" },
                  { value: "duckduckgo", label: "DuckDuckGo" },
                  { value: "web_search", label: "Web Search" },
                ]}
              />

              <FieldSelect
                label="Source Label"
                value={sourceLabelFilter}
                onChange={setSourceLabelFilter}
                options={[
                  { value: "all", label: "All Source Labels" },
                  ...uniqueSourceLabels.map((label) => ({
                    value: label,
                    label,
                  })),
                ]}
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[380px,1fr]">
              <div className="max-h-[920px] space-y-3 overflow-auto pr-1">
                {filteredLeads.length ? (
                  filteredLeads.map((lead) => {
                    const selected = String(lead.id) === String(selectedLead?.id);
                    const score = Number(lead.total_score || 0);
                    const outreachStatus = String(
                      lead.outreach_status || "NOT_CONTACTED"
                    );
                    const contactFound = hasLeadContact(lead);
                    const hasApp = Boolean(lead.has_ios_app || lead.has_android_app);

                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(String(lead.id))}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div
                              className={`truncate text-sm font-semibold ${
                                selected ? "text-white" : "text-zinc-900"
                              }`}
                            >
                              {lead.company_name || "Unnamed Lead"}
                            </div>

                            <div
                              className={`mt-1 truncate text-xs ${
                                selected ? "text-zinc-300" : "text-zinc-500"
                              }`}
                            >
                              {lead.website || lead.contact_email || "No website or email"}
                            </div>

                            <div
                              className={`mt-2 flex flex-wrap gap-1 text-[11px] ${
                                selected ? "text-zinc-200" : "text-zinc-600"
                              }`}
                            >
                              {contactFound ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 ${
                                    selected
                                      ? "border-white/20 bg-white/10"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  Contact Found
                                </span>
                              ) : (
                                <span
                                  className={`rounded-full border px-2 py-0.5 ${
                                    selected
                                      ? "border-white/20 bg-white/10"
                                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                                  }`}
                                >
                                  No Contact
                                </span>
                              )}

                              {hasApp ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 ${
                                    selected
                                      ? "border-white/20 bg-white/10"
                                      : "border-blue-200 bg-blue-50 text-blue-700"
                                  }`}
                                >
                                  App Found
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                selected
                                  ? "border-white/20 bg-white/10 text-white"
                                  : scoreChipClass(score)
                              }`}
                            >
                              {score}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                selected
                                  ? "border-white/20 bg-white/10 text-white"
                                  : statusChipClass(outreachStatus)
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
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
                    No leads match your current filters.
                  </div>
                )}
              </div>

              <div>
                {selectedLead ? (
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-2xl font-semibold text-zinc-900">
                            {selectedLead.company_name || "Unnamed Lead"}
                          </h3>

                          <div className="mt-1 break-all text-sm text-zinc-500">
                            {selectedLead.website ||
                              selectedLead.contact_email ||
                              "No website or email"}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${scoreChipClass(
                                Number(selectedLead.total_score || 0)
                              )}`}
                            >
                              Score {Number(selectedLead.total_score || 0)}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusChipClass(
                                String(selectedLead.outreach_status || "NOT_CONTACTED")
                              )}`}
                            >
                              {String(
                                selectedLead.outreach_status || "NOT_CONTACTED"
                              )}
                            </span>

                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              {appStatusLabel(selectedLead)}
                            </span>

                            {selectedLead.converted_company_id ||
                            selectedLead.converted_opportunity_id ? (
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
                              className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-50"
                            >
                              Open Company
                            </Link>
                          ) : null}

                          {selectedLead.converted_opportunity_id ? (
                            <Link
                              href={`/dashboard/opportunities/${selectedLead.converted_opportunity_id}`}
                              className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-50"
                            >
                              Open Opportunity
                            </Link>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleDeleteLead(String(selectedLead.id))}
                            disabled={deleting}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            {deleting ? "Deleting..." : "Delete Lead"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCard
                          title="Recommended Service"
                          value={serviceLabel(selectedLead.recommended_service_line)}
                        />
                        <InfoCard
                          title="Detected Need"
                          value={pretty(selectedLead.detected_need)}
                        />
                        <InfoCard
                          title="Source"
                          value={pretty(
                            selectedLead.source_label || selectedLead.source_type
                          )}
                        />
                        <InfoCard
                          title="Created"
                          value={fmtDate(selectedLead.created_at)}
                        />
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <TextCard title="AI Summary" value={selectedLead.ai_summary} />
                        <TextCard title="AI Reasoning" value={selectedLead.ai_reasoning} />
                        <TextCard title="Outreach Angle" value={selectedLead.outreach_angle} />
                        <TextCard
                          title="First Touch Message"
                          value={selectedLead.first_touch_message}
                        />
                      </div>
                    </section>
                                        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-zinc-900">
                        Contact, Website, and App Intelligence
                      </h3>

                      <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl border border-zinc-200 p-4">
                          <div className="text-sm font-semibold text-zinc-900">
                            Contact Intelligence
                          </div>

                          <div className="mt-4 space-y-3 text-sm text-zinc-700">
                            <InfoLine title="Primary Email" value={pretty(selectedLead.contact_email)} />
                            <InfoLine title="Primary Phone" value={pretty(selectedLead.contact_phone)} />
                            <InfoLine title="Contact Page" value={pretty(selectedLead.contact_page_url)} />

                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Discovered Emails
                              </div>

                              <div className="mt-1 space-y-1">
                                {toArray(selectedLead.discovered_emails).length ? (
                                  toArray(selectedLead.discovered_emails).map((email, index) => (
                                    <div key={`${email}-${index}`} className="break-all text-sm text-zinc-700">
                                      {email}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-zinc-500">None found yet</div>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Discovered Phones
                              </div>

                              <div className="mt-1 space-y-1">
                                {toArray(selectedLead.discovered_phones).length ? (
                                  toArray(selectedLead.discovered_phones).map((phone, index) => (
                                    <div key={`${phone}-${index}`} className="text-sm text-zinc-700">
                                      {phone}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-zinc-500">None found yet</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 p-4">
                          <div className="text-sm font-semibold text-zinc-900">
                            Website Intelligence
                          </div>

                          <div className="mt-4 space-y-3 text-sm text-zinc-700">
                            <InfoLine
                              title="Analyzed"
                              value={selectedLead.website_analyzed_at ? "Yes" : "No"}
                            />
                            <InfoLine
                              title="Analysis Model"
                              value={pretty(selectedLead.website_analysis_model)}
                            />
                            <InfoLine
                              title="Digital Maturity"
                              value={pretty(
                                selectedLead.website_analysis?.digital_maturity ||
                                  selectedLead.website_analysis?.website_analysis?.digital_maturity
                              )}
                            />
                            <InfoLine
                              title="Last Checked"
                              value={fmtDate(selectedLead.website_analyzed_at)}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 p-4">
                          <div className="text-sm font-semibold text-zinc-900">
                            Mobile App Presence
                          </div>

                          <div className="mt-4 space-y-3 text-sm text-zinc-700">
                            <InfoLine
                              title="App Status"
                              value={appStatusLabel(selectedLead)}
                            />
                            <InfoLine
                              title="App Store Checked"
                              value={fmtDate(selectedLead.app_store_checked_at)}
                            />

                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Apple App Store
                              </div>

                              {selectedLead.apple_app_store_url ? (
                                <a
                                  href={selectedLead.apple_app_store_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 block break-all text-sm font-semibold text-blue-700 hover:underline"
                                >
                                  Open iOS listing
                                </a>
                              ) : (
                                <div className="mt-1 text-sm text-zinc-500">
                                  No iOS listing found
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Google Play Store
                              </div>

                              {selectedLead.google_play_url ? (
                                <a
                                  href={selectedLead.google_play_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 block break-all text-sm font-semibold text-blue-700 hover:underline"
                                >
                                  Open Android listing
                                </a>
                              ) : (
                                <div className="mt-1 text-sm text-zinc-500">
                                  No Android listing found
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-zinc-900">
                        Outreach Workspace
                      </h3>

                      <p className="mt-1 text-sm text-zinc-600">
                        Generate, edit, send, and track your first-touch outreach.
                      </p>

                      <div className="mt-5 grid gap-6 lg:grid-cols-2">
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
                            placeholder="Generate or write your outreach draft here."
                          />

                          <FieldTextarea
                            label="Internal Outreach Notes"
                            value={outreachNotes}
                            onChange={setOutreachNotes}
                            rows={4}
                            placeholder="Internal notes about this lead."
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleGenerateOutreach}
                              disabled={outreachSaving}
                              className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-50 disabled:opacity-60"
                            >
                              {outreachSaving ? "Generating..." : "Generate Outreach"}
                            </button>

                            <button
                              type="button"
                              onClick={handleSaveDraft}
                              disabled={draftSaving}
                              className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-50 disabled:opacity-60"
                            >
                              {draftSaving ? "Saving..." : "Save Draft"}
                            </button>

                            <button
                              type="button"
                              onClick={handleSendOutreach}
                              disabled={sendSaving}
                              className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                            >
                              {sendSaving ? "Sending..." : "Send Outreach"}
                            </button>

                            <button
                              type="button"
                              onClick={handleMarkManualSent}
                              disabled={manualSentSaving}
                              className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-50 disabled:opacity-60"
                            >
                              {manualSentSaving ? "Logging..." : "Mark Manual Sent"}
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
                              { value: "NONE", label: "None" },
                              { value: "SCHEDULED", label: "Scheduled" },
                              { value: "DUE", label: "Due" },
                              { value: "COMPLETED", label: "Completed" },
                              { value: "PAUSED", label: "Paused" },
                            ]}
                          />

                          <FieldTextarea
                            label="Follow-Up Notes"
                            value={followUpNotes}
                            onChange={setFollowUpNotes}
                            rows={4}
                            placeholder="Notes for the next touchpoint."
                          />

                          <button
                            type="button"
                            onClick={handleScheduleFollowUp}
                            disabled={followUpSaving}
                            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-50 disabled:opacity-60"
                          >
                            {followUpSaving ? "Saving..." : "Save Follow-Up"}
                          </button>

                          <div className="border-t border-zinc-200 pt-4">
                            <FieldInput
                              label="Reply Email"
                              value={replyEmail}
                              onChange={setReplyEmail}
                              placeholder="person@company.com"
                            />

                            <div className="mt-4">
                              <FieldTextarea
                                label="Reply Message"
                                value={replyMessage}
                                onChange={setReplyMessage}
                                rows={4}
                                placeholder="Log a response from this lead."
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleSaveReply}
                              disabled={replySaving}
                              className="mt-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-50 disabled:opacity-60"
                            >
                              {replySaving ? "Saving..." : "Log Reply"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                                        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-zinc-900">
                        Conversion and Outcome
                      </h3>

                      <div className="mt-5 grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                          <FieldTextarea
                            label="Outcome Notes"
                            value={outcomeNotes}
                            onChange={setOutcomeNotes}
                            rows={5}
                            placeholder="Why did this lead win, lose, pause, or not respond?"
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveOutcome("WON")}
                              disabled={outcomeSaving}
                              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              Mark Won
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveOutcome("LOST")}
                              disabled={outcomeSaving}
                              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                            >
                              Mark Lost
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveOutcome("NO_RESPONSE")}
                              disabled={outcomeSaving}
                              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-60"
                            >
                              No Response
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                          <div className="text-sm font-semibold text-zinc-900">
                            Convert Lead
                          </div>

                          <p className="mt-2 text-sm leading-6 text-zinc-600">
                            Convert this lead into a company profile and opportunity when it is ready for the pipeline.
                          </p>

                          <button
                            type="button"
                            onClick={handleConvertLead}
                            disabled={convertSaving}
                            className="mt-4 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                          >
                            {convertSaving ? "Converting..." : "Convert to Company + Opportunity"}
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-zinc-900">
                        Outreach History
                      </h3>

                      <div className="mt-4 space-y-3">
                        {loadingEvents ? (
                          <div className="text-sm text-zinc-500">
                            Loading outreach history...
                          </div>
                        ) : events.length ? (
                          events.map((event, index) => (
                            <div
                              key={event.id || index}
                              className="rounded-2xl border border-zinc-200 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-900">
                                    {pretty(event.event_type)}
                                  </div>

                                  <div className="mt-1 text-xs text-zinc-500">
                                    {pretty(event.channel)} · {pretty(event.direction)} · {pretty(event.delivery_status)}
                                  </div>
                                </div>

                                <div className="text-xs text-zinc-500">
                                  {fmtDate(event.created_at)}
                                </div>
                              </div>

                              {event.subject ? (
                                <div className="mt-3 text-sm text-zinc-700">
                                  <span className="font-semibold">Subject:</span>{" "}
                                  {event.subject}
                                </div>
                              ) : null}

                              {event.recipient_email ? (
                                <div className="mt-1 break-all text-sm text-zinc-700">
                                  <span className="font-semibold">Recipient:</span>{" "}
                                  {event.recipient_email}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-zinc-500">
                            No outreach history yet.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-8 text-center shadow-sm">
                    <h3 className="text-lg font-semibold text-zinc-900">
                      No Lead Selected
                    </h3>

                    <p className="mt-2 text-sm text-zinc-500">
                      Select a lead from the queue to view intelligence, outreach, and conversion actions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {props.label}
      </div>

      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {props.label}
      </div>

      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {props.label}
      </div>

      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={props.rows}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
        placeholder={props.placeholder}
      />
    </div>
  );
}

function InfoCard(props: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {props.title}
      </div>

      <div className="mt-2 break-words text-sm font-semibold text-zinc-900">
        {props.value}
      </div>
    </div>
  );
}

function TextCard(props: { title: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {props.title}
      </div>

      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
        {props.value || "No content yet."}
      </div>
    </div>
  );
}

function InfoLine(props: { title: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {props.title}
      </div>

      <div className="mt-1 break-all text-sm text-zinc-700">
        {props.value}
      </div>
    </div>
  );
}