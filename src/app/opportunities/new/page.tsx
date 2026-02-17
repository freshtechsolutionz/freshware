import { redirect } from "next/navigation";

export default function NewOpportunityRedirect() {
  redirect("/dashboard/opportunities/new");
}
