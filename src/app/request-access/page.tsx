"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

type FormState = {
  full_name: string;
  email: string;
  company: string;
  reason: string;
};

export default function RequestAccessPage() {
  const [form, setForm] = useState<FormState>({
    full_name: "",
    email: "",
    company: "",
    reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return form.full_name.trim().length >= 2 && form.email.trim().includes("@");
  }, [form.full_name, form.email]);

  async function submit() {
    setErrorMsg(null);

    if (!canSubmit) {
      setErrorMsg("Please enter your name and a valid email.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("access_requests").insert({
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      company: form.company.trim() || null,
      reason: form.reason.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
        <header className="mx-auto max-w-3xl px-6 py-6">
          <Link href="/" className="text-sm font-semibold text-gray-900 hover:underline">
            Back to portal entry
          </Link>
        </header>

        <main className="mx-auto max-w-3xl px-6 pb-16">
          <div className="rounded-3xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900">Request received</h1>
            <p className="mt-3 text-sm text-gray-600">
              Your request has been submitted. If you should have access, you will receive an invitation or instructions from your workspace admin.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
              >
                Log in
              </Link>
              <Link
                href="/"
                className="rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
              >
                Return to portal entry
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white">
      <header className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
            F
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">Freshware</div>
            <div className="text-sm text-gray-600">Invite-only access</div>
          </div>
        </Link>
        <Link href="/login" className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50">
          Log in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Request access</h1>
          <p className="mt-3 text-sm text-gray-600">
            Freshware is invite-only. If you have been asked to collaborate or need access to your organization’s workspace, submit your request below.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4">
            <Field label="Full name" required>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Your name"
              />
            </Field>

            <Field label="Email" required>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                placeholder="you@company.com"
              />
            </Field>

            <Field label="Company (optional)">
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Company name"
              />
            </Field>

            <Field label="Reason (optional)">
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full min-h-[120px] rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Tell us what you need access for"
              />
            </Field>

            {errorMsg && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="rounded-2xl px-5 py-3 text-sm font-semibold bg-black text-white disabled:opacity-50 hover:opacity-90"
            >
              {submitting ? "Submitting..." : "Submit request"}
            </button>

            <div className="text-sm text-gray-600">
              Already have access?{" "}
              <Link className="font-semibold text-gray-900 hover:underline" href="/login">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field(props: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-gray-900">
        {props.label} {props.required ? <span className="text-gray-500">(required)</span> : null}
      </div>
      <div className="mt-2">{props.children}</div>
    </label>
  );
}
