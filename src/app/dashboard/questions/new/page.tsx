import type { Metadata } from "next";
import { redirect } from "next/navigation";

import NewQuestionTabs from "@/components/questions/NewQuestionTabs";
import { requireAuth } from "@/lib/auth/session";
import { hasPermissionOrOrgMembership } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "New question" };
export const dynamic = "force-dynamic";

export default async function NewQuestionPage() {
  const user = await requireAuth();

  // The API enforces this too; redirecting avoids showing a form that cannot save.
  const canCreate = await hasPermissionOrOrgMembership(user, "question:create", "question:create");
  if (!canCreate) redirect("/dashboard/questions");

  return (
    <NewQuestionTabs
      canReview={await hasPermissionOrOrgMembership(user, "question:review", "question:review")}
    />
  );
}
