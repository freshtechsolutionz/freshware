import PageHeader from "@/components/dashboard/PageHeader";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Meeting = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  scheduled_at: string | null;
  status: string | null;
  source: string | null;
  description: string | null;
  created_at: string | null;
};

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
}

function rangeLabel(r: string) {
  if (r === "today") return "Today";
  if (r === "week") return "This week";
  if (r === "7") return "Last 7 days";
  if (r === "30") return "Last 30 days";
  return "All";
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/meetings");

  const range = (searchParams?.range || "").toLowerCase(); // today | week | 7 | 30 | ""

  // Account-scoped meetings
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return (
      <>
        <PageHeader title="Meetings" subtitle="Scheduled calls, demos, and follow-ups." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Your profile is missing account_id.
        </div>
      </>
    );
  }

  let since: string | null = null;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "today") {
    since = start.toISOString();
  } else if (range === "week") {
    const day = start.getDay(); // 0 Sun
    const mondayDelta = (day === 0 ? -6 : 1 - day);
    const monday = new Date(start);
    monday.setDate(start.getDate() + mondayDelta);
    since = monday.toISOString();
  } else if (range === "7") {
    const d = new Date(start);
    d.setDate(start.getDate() - 6);
    since = d.toISOString();
  } else if (range === "30") {
    const d = new Date(start);
    d.setDate(start.getDate() - 29);
    since = d.toISOString();
  }

  let q = supabase
    .from("meetings")
    .select("id,contact_name,contact_email,scheduled_at,status,source,description,created_at")
    .eq("account_id", profile.account_id)
    .order("scheduled_at", { ascending: false });

  if (since) q = q.gte("scheduled_at", since);

  const { data, error } = await q;

  if (error) {
    return (
      <>
        <PageHeader title="Meetings" subtitle="Scheduled calls, demos, and follow-ups." />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading meetings: {error.message}
        </div>
      </>
    );
  }

  const meetings = (data || []) as Meeting[];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Meetings" subtitle="Scheduled calls, demos, and follow-ups." />
        <div className="flex flex-wrap gap-2">
          {[
            { r: "", label: "All" },
            { r: "today", label: "Today" },
            { r: "week", label: "This week" },
            { r: "7", label: "Last 7 days" },
            { r: "30", label: "Last 30 days" },
          ].map((x) => (
            <Link
              key={x.label}
              href={`/dashboard/meetings${x.r ? `?range=${x.r}` : ""}`}
              className={`rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 ${
                (range || "") === x.r ? "ring-1 ring-black/10" : ""
              }`}
            >
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing: <span className="font-semibold text-gray-900">{rangeLabel(range)}</span> ·{" "}
            <span className="font-semibold text-gray-900">{meetings.length}</span> meetings
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border bg-white">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-3 font-semibold">Meeting Date/Time</th>
                <th className="p-3 font-semibold">Contact</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Source</th>
                <th className="p-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{fmtWhen(m.scheduled_at)}</td>
                  <td className="p-3">{m.contact_name || "—"}</td>
                  <td className="p-3">{m.contact_email || "—"}</td>
                  <td className="p-3">{m.status || "—"}</td>
                  <td className="p-3">{m.source || "—"}</td>
                  <td className="p-3">{m.description || "—"}</td>
                </tr>
              ))}
              {!meetings.length ? (
                <tr className="border-t">
                  <td className="p-4 text-gray-600" colSpan={6}>
                    No meetings found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Note: YCBM bookings can still land here via webhook. Manual meetings can include description.
        </div>
      </div>
    </>
  );
}
