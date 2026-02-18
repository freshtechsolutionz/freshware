import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
  account_id: string | null;

  avatar_url: string | null;
  phone: string | null;
  birthday: string | null;
  industry: string | null;
  expertise: string | null;
  bio: string | null;
  linkedin_url: string | null;
  booking_url: string | null;
  website_url: string | null;
  resume_url: string | null;
};

function initials(nameOrEmail: string | null) {
  const s = (nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Row(props: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="text-xs font-semibold text-zinc-700">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{props.value || "—"}</div>
    </div>
  );
}

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/team/${encodeURIComponent(id)}`);

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  const roleUpper = String(me?.role || "").toUpperCase();
  if (roleUpper === "CLIENT_USER") redirect("/dashboard");
  if (!me?.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Team</div>
        <div className="mt-2 text-sm text-gray-600">Your profile is missing account_id.</div>
      </div>
    );
  }

  const accountId = me.account_id as string;

  // Only allow viewing profiles within the same account
  const { data: p, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, email, account_id, avatar_url, phone, birthday, industry, expertise, bio, linkedin_url, booking_url, website_url, resume_url"
    )
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error || !p) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Team</div>
        <div className="mt-2 text-sm text-gray-600">Unable to load this profile.</div>
        <div className="mt-5">
          <Link href="/dashboard/team" className="fw-btn text-sm">
            Back to Team
          </Link>
        </div>
      </div>
    );
  }

  const prof = p as Profile;
  const ini = initials(prof.full_name || prof.email);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Team Profile</div>
          <div className="mt-1 text-sm text-zinc-600">Profile details for your company directory.</div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/team" className="fw-btn text-sm">
            Back to Team
          </Link>
          {auth.user.id === id ? (
            <Link href="/dashboard/profile" className="fw-btn text-sm">
              Edit my profile
            </Link>
          ) : null}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="fw-card-strong p-6">
          <div className="text-sm font-semibold text-zinc-900">Identity</div>

          <div className="mt-4 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-white flex items-center justify-center text-sm font-semibold text-zinc-800">
              {prof.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={prof.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                ini
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {prof.full_name || prof.email || prof.id}
              </div>
              <div className="mt-1 text-xs text-zinc-600 break-all">{prof.email || ""}</div>
              <div className="mt-2 text-xs text-zinc-600">
                Role: <span className="font-semibold text-zinc-900">{prof.role || "—"}</span>
              </div>
            </div>
          </div>

          {prof.bio ? (
            <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-zinc-700">
              <div className="text-xs font-semibold text-zinc-700">Bio</div>
              <div className="mt-1 whitespace-pre-line">{prof.bio}</div>
            </div>
          ) : null}
        </div>

        <div className="fw-card-strong p-6 lg:col-span-2">
          <div className="text-sm font-semibold text-zinc-900">Details</div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Row label="Phone" value={prof.phone} />
            <Row label="Birthday" value={prof.birthday} />
            <Row label="Industry" value={prof.industry} />
            <Row label="Expertise" value={prof.expertise} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Row label="LinkedIn" value={prof.linkedin_url} />
            <Row label="Booking link" value={prof.booking_url} />
            <Row label="Website" value={prof.website_url} />
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm">
            <div className="text-xs font-semibold text-zinc-700">Resume / Document</div>
            <div className="mt-2">
              {prof.resume_url ? (
                <a className="underline" href={prof.resume_url} target="_blank" rel="noreferrer">
                  Open resume
                </a>
              ) : (
                <span className="text-zinc-600">No resume uploaded.</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
