import PageHeader from "@/components/dashboard/PageHeader";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import MeetingsClient from "./MeetingsClient";

export const runtime = "nodejs";

export type MeetingRow = {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  scheduled_at: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  source: string | null;
  description: string | null;

  meeting_summary: string | null;
  notes: string | null;
  meeting_link: string | null;

  external_id: string | null;
  booking_page: string | null;
  event_type: string | null;

  opportunity_id: string | null;
  contact_id: string | null;

  created_at: string | null;
};

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
    const mondayDelta = day === 0 ? -6 : 1 - day;
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
    .select(
      "id,contact_name,contact_email,scheduled_at,start_at,end_at,status,source,description,meeting_summary,notes,meeting_link,external_id,booking_page,event_type,opportunity_id,contact_id,created_at"
    )
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

  const meetings = (data || []) as MeetingRow[];

  return (
    <MeetingsClient
      range={range}
      rangeLabel={rangeLabel(range)}
      meetings={meetings}
    />
  );
}