import type { Metadata } from "next";
import { redirect } from "next/navigation";

import QuestionForm from "@/components/questions/QuestionForm";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "New question" };
export const dynamic = "force-dynamic";

export default async function NewQuestionPage() {
  const user = await requireAuth();

  // The API enforces this too; redirecting avoids showing a form that cannot save.
  if (!can(user.role, "question:create")) redirect("/dashboard/questions");

  return <QuestionForm mode="create" canReview={can(user.role, "question:review")} />;
}
