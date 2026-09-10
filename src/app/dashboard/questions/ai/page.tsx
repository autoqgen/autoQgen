import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AiGenerate from "@/components/questions/AiGenerate";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { taxonomyService } from "@/lib/services/taxonomy.service";
import { aiQuestionService } from "@/lib/services/ai-question.service";

export const metadata: Metadata = { title: "AI Generated Questions" };
export const dynamic = "force-dynamic";

export default async function AiQuestionsPage() {
  const user = await requireAuth();

  // Generating is the entry capability; the API enforces it (and import) again.
  if (!can(user.role, "question:generate-ai")) redirect("/dashboard/questions");

  // Categories are scoped to the caller's current organization; an actor with
  // no organization simply sees none and cannot generate.
  const { items } = await taxonomyService.list(
    "category",
    { page: 1, limit: 100, includeInactive: false, search: undefined },
    user,
  );

  return (
    <AiGenerate
      available={aiQuestionService.available}
      canImport={can(user.role, "question:import")}
      categories={items.map((item) => ({ _id: item._id.toString(), name: item.name }))}
    />
  );
}
