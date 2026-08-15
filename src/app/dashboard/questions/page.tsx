import type { Metadata } from "next";

import QuestionBrowser from "@/components/dashboard/QuestionBrowser";
import { requireAuth } from "@/lib/auth/session";
import { canReadAnswers } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Questions" };
export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const user = await requireAuth();

  /**
   * The flag only controls whether the UI offers the toggle. The API re-checks
   * the same permission server-side, so flipping it in devtools achieves
   * nothing.
   */
  return <QuestionBrowser canReadAnswers={canReadAnswers(user.role)} />;
}
