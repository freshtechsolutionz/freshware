import PageHeader from "@/components/dashboard/PageHeader";
import MeetingsTable from "@/components/MeetingsTable";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type Meeting = {
  id: string;
  external_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  scheduled_at: string | null;
  status: string | null;
  source: string | null;
  created_at: string | null;
  account_id: string | null;
  created_by: string | null;
};

export default async function MeetingsPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/meetings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = (profile?.role || "STAFF") as string;

  const { data, error } = await supabase
    .from("meetings")
    .select(
      "id,external_id,contact_email,contact_name,scheduled_at,status,source,created_at,account_id,created_by"
    )
    .order("scheduled_at", { ascending: false });

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
      <PageHeader title="Meetings" subtitle="Scheduled calls, demos, and follow-ups." />
      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <MeetingsTable role={role} meetings={meetings} />
      </div>
    </>
  );
}
