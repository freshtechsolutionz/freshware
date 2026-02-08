import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import PageHeader from "@/components/dashboard/PageHeader";
import EditMeetingForm from "./EditMeetingForm";

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
};

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
  if (!auth.user) redirect(`/portal?next=/dashboard/meetings/${id}`);

  const { data, error } = await supabase
    .from("meetings")
    .select(
      "id,external_id,contact_email,contact_name,scheduled_at,status,source,created_at,account_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHeader
          title="Edit Meeting"
          subtitle="Update meeting details."
          right={
            <Link
              href="/dashboard/meetings"
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Back to Meetings
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          Error loading meeting: {error.message}
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader
          title="Meeting not found"
          subtitle="This meeting may have been deleted."
          right={
            <Link
              href="/dashboard/meetings"
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Back to Meetings
            </Link>
          }
        />
        <div className="rounded-2xl border bg-background p-4 text-sm">
          No record found for id: {id}
        </div>
      </>
    );
  }

  return <EditMeetingForm initial={data as Meeting} />;
}
