import PageHeader from "@/components/dashboard/PageHeader";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const runtime = "nodejs";

type Meeting = {
  id: string;
  scheduled_at: string | null;
  start_at: string | null;
  status: string | null;
  source: string | null;
  contact_name: string | null;
  contact_email: string | null;
  meeting_summary: string | null;
  meeting_link: string | null;
};

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
}

export default async function OpportunityMeetingsPage({ params }: { params: { id: string } }) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/portal?next=/dashboard/opportunities/${params.id}/meetings`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <>
        <PageHeader title="Deal Meetings" subtitle="Upcoming and past meetings for this deal." />
        <div className="rounded-2xl border bg-background p-4 text-sm">Your profile is missing account_id.</div>
      </>
    );
  }

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id,name,stage,amount")
    .eq("account_id", profile.account_id)
    .eq("id", params.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("meetings")
    .select("id,scheduled_at,start_at,status,source,contact_name,contact_email,meeting_summary,meeting_link")
    .eq("account_id", profile.account_id)
    .eq("opportunity_id", params.id)
    .order("scheduled_at", { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Deal Meetings" subtitle="Upcoming and past meetings for this deal." />
        <div className="rounded-2xl border bg-background p-4 text-sm">Error: {error.message}</div>
      </>
    );
  }

  const all = (data || []) as Meeting[];
  const now = new Date();

  const upcoming = all.filter((m) => {
    const d = new Date(m.scheduled_at || m.start_at || "");
    return Number.isFinite(d.getTime()) && d.getTime() >= now.getTime();
  });

  const past = all.filter((m) => !upcoming.includes(m));

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Deal Meetings"
          subtitle={`Deal: ${opp?.name || params.id}`}
        />
        <div className="flex gap-2">
          <Link className="underline" href="/dashboard/opportunities">
            ← Opportunities
          </Link>
          <Link className="underline" href="/dashboard/meetings">
            Meetings
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Upcoming</div>
          <div className="mt-3 space-y-2">
            {upcoming.length ? (
              upcoming.map((m) => (
                <div key={m.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link className="underline font-semibold" href={`/dashboard/meetings/${m.id}`}>
                      {fmtWhen(m.scheduled_at || m.start_at)}
                    </Link>
                    {m.meeting_link ? (
                      <a className="underline text-sm" href={m.meeting_link} target="_blank" rel="noreferrer">
                        Join
                      </a>
                    ) : null}
                  </div>
                  <div className="text-sm text-gray-700">{m.contact_name || "—"} · {m.contact_email || "—"}</div>
                  <div className="text-sm text-gray-600 line-clamp-2 mt-1">{m.meeting_summary || "—"}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-600">No upcoming meetings.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Past</div>
          <div className="mt-3 space-y-2">
            {past.length ? (
              past.map((m) => (
                <div key={m.id} className="rounded-xl border p-3">
                  <Link className="underline font-semibold" href={`/dashboard/meetings/${m.id}`}>
                    {fmtWhen(m.scheduled_at || m.start_at)}
                  </Link>
                  <div className="text-sm text-gray-700">{m.contact_name || "—"} · {m.contact_email || "—"}</div>
                  <div className="text-sm text-gray-600 line-clamp-2 mt-1">{m.meeting_summary || "—"}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-600">No past meetings.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}