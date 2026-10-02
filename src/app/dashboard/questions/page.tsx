import type { Metadata } from "next";
import { redirect } from "next/navigation";

import QuestionBrowser from "@/components/dashboard/QuestionBrowser";
import { requireAuth } from "@/lib/auth/session";
import { canReadAnswers } from "@/lib/auth/rbac";
import { hasPermissionOrOrgMembership } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "Questions" };
export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const user = await requireAuth();
  const canRead = await hasPermissionOrOrgMembership(user, "question:read", "question:read");
  if (!canRead) redirect("/dashboard");

  /**
   * The flag only controls whether the UI offers the toggle. The API re-checks
   * the same permission server-side, so flipping it in devtools achieves
   * nothing.
   */
  return <QuestionBrowser canReadAnswers={canReadAnswers(user.role)} />;
}
