import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { aiQuestionService } from "@/lib/services/ai-question.service";
import {
  aiGenerateQuestionsSchema,
  type AiGenerateQuestionsInput,
} from "@/lib/validation/ai-question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ask Google Gemini for questions. Read-only: nothing is written here.
 *
 * The organization is resolved from the session, every taxonomy id is
 * validated against it, and duplicate detection is scoped to that
 * organization's question bank. `question:generate-ai` is enforced here and
 * again inside the service.
 */
export const POST = defineRoute<AiGenerateQuestionsInput>({
  auth: true,
  organizationPermission: {
    globalPermission: "question:generate-ai",
    organizationPermission: "question:generate-ai",
  },
  rateLimit: "aiGenerate",
  bodySchema: aiGenerateQuestionsSchema,
  async handler({ body, user, audit, requestId }) {
    const result = await aiQuestionService.generate(body, user, audit);
    return ok(result, { requestId });
  },
});
