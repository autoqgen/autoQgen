import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { aiQuestionService } from "@/lib/services/ai-question.service";
import {
  aiCheckDuplicatesSchema,
  type AiCheckDuplicatesInput,
} from "@/lib/validation/ai-question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-check duplicate status for edited question texts, scoped to the caller's
 * organization. No AI call, no writes — one indexed lookup.
 */
export const POST = defineRoute<AiCheckDuplicatesInput>({
  auth: true,
  permission: "question:generate-ai",
  rateLimit: "read",
  bodySchema: aiCheckDuplicatesSchema,
  async handler({ body, user, requestId }) {
    const items = await aiQuestionService.checkDuplicates(body, user);
    return ok({ items }, { requestId });
  },
});
