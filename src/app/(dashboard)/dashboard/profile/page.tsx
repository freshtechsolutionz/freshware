"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  account_id: string | null;

  avatar_url: string | null;
  phone: string | null;
  birthday: string | null; // ISO date
  industry: string | null;
  expertise: string | null;
  bio: string | null;
  linkedin_url: string | null;
  booking_url: string | null;
  website_url: string | null;
  resume_url: string | null;
};

function cls(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function ProfilePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState(""); // yyyy-mm-dd
  const [industry, setIndustry] = useState("");
  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  async function load() {
    setLoading(true);
    setError(null);

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }
    const user = auth.user;
    if (!user) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    setMe({ id: user.id, email: user.email ?? null });

    const { data, error: profErr } = await supabase
      .from("profiles")
      .select(
        "id, full_name, role, account_id, avatar_url, phone, birthday, industry, expertise, bio, linkedin_url, booking_url, website_url, resume_url"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      setError(profErr.message);
      setLoading(false);
      return;
    }

    const row = (data as ProfileRow) ?? null;
    setProfile(row);

    // hydrate form
    setFullName(row?.full_name ?? "");
    setPhone(row?.phone ?? "");
    setBirthday(row?.birthday ?? "");
    setIndustry(row?.industry ?? "");
    setExpertise(row?.expertise ?? "");
    setBio(row?.bio ?? "");
    setLinkedinUrl(row?.linkedin_url ?? "");
    setBookingUrl(row?.booking_url ?? "");
    setWebsiteUrl(row?.website_url ?? "");

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function saveProfile() {
    if (!me) return;
    setSaving(true);
    setError(null);

    const payload: Partial<ProfileRow> = {
      id: me.id,
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      birthday: birthday || null,
      industry: industry.trim() || null,
      expertise: expertise.trim() || null,
      bio: bio.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      booking_url: bookingUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
    };

    const { error: upErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    setSaving(false);

    if (upErr) {
      setError(upErr.message);
      return;
    }

    setToast("Profile saved");
    await load();
  }

  async function uploadAvatar(file: File) {
    if (!me || !profile?.account_id) {
      setError("Missing user/account.");
      return;
    }
    setError(null);
    setSaving(true);

    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.account_id}/${me.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

    if (upErr) {
      setSaving(false);
      setError(upErr.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const { error: profErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", me.id);
    setSaving(false);

    if (profErr) {
      setError(profErr.message);
      return;
    }

    setToast("Avatar updated");
    await load();
  }

  async function uploadResume(file: File) {
    if (!me || !profile?.account_id) {
      setError("Missing user/account.");
      return;
    }
    setError(null);
    setSaving(true);

    const safe = safeName(file.name);
    const path = `${profile.account_id}/${me.id}/${Date.now()}-${safe}`;

    const { error: upErr } = await supabase.storage.from("profile-files").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    if (upErr) {
      setSaving(false);
      setError(upErr.message);
      return;
    }

    // If bucket is public, use public URL
    const { data } = supabase.storage.from("profile-files").getPublicUrl(path);
    const url = data.publicUrl;

    // Save as primary resume_url + also store in profile_assets
    await supabase.from("profiles").update({ resume_url: url }).eq("id", me.id);

    await supabase.from("profile_assets").insert({
      profile_id: me.id,
      account_id: profile.account_id,
      kind: "resume",
      label: file.name,
      url,
    });

    setSaving(false);
    setToast("Resume uploaded");
    await load();
  }

  if (loading) {
    return (
      <div className="fw-card-strong p-7">
        <div className="h-6 w-56 rounded bg-black/10 animate-pulse" />
        <div className="mt-4 h-10 w-full rounded-2xl bg-black/10 animate-pulse" />
        <div className="mt-3 h-10 w-full rounded-2xl bg-black/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">My Profile</div>
          <div className="mt-1 text-sm text-zinc-600">
            Keep this updated — Freshware uses this as your client/employee profile card.
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} className="fw-btn text-sm disabled:opacity-60" type="button">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {toast ? (
        <div className="fw-card-strong p-4 text-sm font-semibold text-zinc-900">{toast}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Avatar card */}
        <div className="fw-card-strong p-6">
          <div className="text-sm font-semibold text-zinc-900">Avatar</div>
          <div className="mt-3 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-white">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm font-semibold text-zinc-700">
                  {(profile?.full_name || me?.email || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">{profile?.full_name || "—"}</div>
              <div className="text-xs text-zinc-600 break-all">{me?.email || ""}</div>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-zinc-700">Upload photo</label>
            <input
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
            <div className="mt-2 text-xs text-zinc-500">Square photo looks best.</div>
          </div>
        </div>

        {/* Resume card */}
        <div className="fw-card-strong p-6">
          <div className="text-sm font-semibold text-zinc-900">Resume / Documents</div>
          <div className="mt-2 text-sm text-zinc-600">
            Upload resumes, certificates, portfolios. (We’ll add multi-doc management next.)
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-zinc-700">Upload resume</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="mt-2 block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadResume(f);
              }}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm">
            <div className="text-xs font-semibold text-zinc-700">Current</div>
            <div className="mt-1">
              {profile?.resume_url ? (
                <a className="underline" href={profile.resume_url} target="_blank" rel="noreferrer">
                  Open resume
                </a>
              ) : (
                <span className="text-zinc-600">None uploaded yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* Meta card */}
        <div className="fw-card-strong p-6">
          <div className="text-sm font-semibold text-zinc-900">Account</div>
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <div>
              <span className="font-semibold text-zinc-900">Role:</span> {profile?.role || "—"}
            </div>
            <div className="break-all">
              <span className="font-semibold text-zinc-900">Account ID:</span> {profile?.account_id || "—"}
            </div>
            <div className="text-xs text-zinc-500">
              Only users in your account can view your profile in the directory (based on access level).
            </div>
          </div>
        </div>
      </section>

      {/* Main form */}
      <section className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-zinc-900">Profile Details</div>
        <div className="mt-1 text-sm text-zinc-600">This is what we’ll use for client/team directories.</div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Full name">
            <input className="fw-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>

          <Field label="Phone">
            <input className="fw-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(###) ###-####" />
          </Field>

          <Field label="Birthday">
            <input className="fw-input" value={birthday} onChange={(e) => setBirthday(e.target.value)} type="date" />
          </Field>

          <Field label="Industry">
            <input className="fw-input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g., Healthcare, SaaS, Construction" />
          </Field>

          <Field label="Expertise">
            <input className="fw-input" value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="e.g., Sales, Ops, PM, React, Salesforce" />
          </Field>

          <Field label="LinkedIn URL">
            <input className="fw-input" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </Field>

          <Field label="Booking link">
            <input className="fw-input" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://youcanbook.me/..." />
          </Field>

          <Field label="Website URL">
            <input className="fw-input" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
          </Field>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold text-zinc-900">Bio</div>
          <div className="mt-2">
            <textarea className="fw-textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio. What should people know about you?" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button onClick={saveProfile} disabled={saving} className="fw-btn text-sm disabled:opacity-60" type="button">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-zinc-900">{props.label}</div>
      <div className="mt-2">{props.children}</div>
    </label>
  );
}
