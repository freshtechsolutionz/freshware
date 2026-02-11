import PageHeader from "@/components/dashboard/PageHeader";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import CreateProjectForm from "./CreateProjectForm";

export const runtime = "nodejs";

export default async function NewProjectPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/projects/new");

  return (
    <>
      <PageHeader
        title="New Project"
        subtitle="Create a new project."
      />
      <CreateProjectForm />
    </>
  );
}
