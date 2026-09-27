import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { aiQuestionService } from "@/lib/services/ai-question.service";
import {
  aiGenerateCreativeGroupSchema,
  type AiGenerateCreativeGroupInput,
} from "@/lib/validation/ai-question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<AiGenerateCreativeGroupInput>({
  auth: true,
  organizationPermission: {
    globalPermission: "question:generate-ai",
    organizationPermission: "question:generate-ai",
  },
  rateLimit: "aiGenerate",
  bodySchema: aiGenerateCreativeGroupSchema,
  async handler({ body, user, requestId }) {
    const result = await aiQuestionService.generateCreativeGroup(body, user);
    return ok(result, { requestId });
  },
});
