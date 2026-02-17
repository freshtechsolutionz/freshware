import { redirect } from "next/navigation";

export default async function OpportunityIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/opportunities/${id}`);
}
