"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

type FormState = {
  name: string;
  legal_name: string;
  website: string;
  linkedin_url: string;
  industry: string;
  customer_segment: string;
  lifecycle_stage: string;
  priority_level: string;
  primary_contact_name: string;
  primary_contact_role: string;
  primary_contact_email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  primary_business_goals: string;
  top_pain_points: string;
};

export default function NewAccountForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    legal_name: "",
    website: "",
    linkedin_url: "",
    industry: "",
    customer_segment: "SMB",
    lifecycle_stage: "lead",
    priority_level: "standard",
    primary_contact_name: "",
    primary_contact_role: "",
    primary_contact_email: "",
    phone: "",
    city: "",
    state: "",
    country: "USA",
    primary_business_goals: "",
    top_pain_points: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) return setError("Please enter a company name.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "Failed to create company.");
        setSubmitting(false);
        return;
      }

      const id = json?.company?.id;
      router.push(id ? `/dashboard/accounts/${id}` : "/dashboard/accounts");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating company.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Company Profile"
        subtitle="Create a customer company record for targeting, sales, delivery, and forecasting."
        right={
          <Link href="/dashboard/accounts" className="rounded-lg border px-3 py-2 text-sm">
            Back to Company Profiles
          </Link>
        }
      />

      <div className="rounded-2xl border bg-background p-6 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Company name</label>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g., Greater Heights Chamber of Commerce"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Legal name</label>
              <input
                value={form.legal_name}
                onChange={(e) => setField("legal_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Industry</label>
              <input
                value={form.industry}
                onChange={(e) => setField("industry", e.target.value)}
                placeholder="Healthcare, Nonprofit, Chamber, Restaurant..."
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Website</label>
              <input
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">LinkedIn URL</label>
              <input
                value={form.linkedin_url}
                onChange={(e) => setField("linkedin_url", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Customer segment</label>
              <select
                value={form.customer_segment}
                onChange={(e) => setField("customer_segment", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="SMB">SMB</option>
                <option value="mid_market">Mid Market</option>
                <option value="enterprise">Enterprise</option>
                <option value="nonprofit">Nonprofit</option>
                <option value="startup">Startup</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Lifecycle stage</label>
              <select
                value={form.lifecycle_stage}
                onChange={(e) => setField("lifecycle_stage", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="lead">Lead</option>
                <option value="qualified">Qualified</option>
                <option value="active">Active</option>
                <option value="at_risk">At Risk</option>
                <option value="churned">Churned</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Priority level</label>
              <select
                value={form.priority_level}
                onChange={(e) => setField("priority_level", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="strategic">Strategic</option>
                <option value="standard">Standard</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Primary contact name</label>
              <input
                value={form.primary_contact_name}
                onChange={(e) => setField("primary_contact_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Primary contact role</label>
              <input
                value={form.primary_contact_role}
                onChange={(e) => setField("primary_contact_role", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Primary contact email</label>
              <input
                value={form.primary_contact_email}
                onChange={(e) => setField("primary_contact_email", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">City</label>
              <input
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">State</label>
              <input
                value={form.state}
                onChange={(e) => setField("state", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Country</label>
              <input
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Primary business goals</label>
              <textarea
                value={form.primary_business_goals}
                onChange={(e) => setField("primary_business_goals", e.target.value)}
                className="min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Top pain points</label>
              <textarea
                value={form.top_pain_points}
                onChange={(e) => setField("top_pain_points", e.target.value)}
                className="min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create company profile"}
            </button>

            <Link href="/dashboard/accounts" className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}