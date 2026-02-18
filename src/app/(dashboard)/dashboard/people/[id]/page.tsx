import { redirect } from "next/navigation";

export default async function PeopleIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/team/${encodeURIComponent(id)}`);
}
