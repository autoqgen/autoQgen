import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { questionService } from "@/lib/services/question.service";
import {
  aiImportCreativeGroupSchema,
  type AiImportCreativeGroupInput,
} from "@/lib/validation/ai-question.schema";
import { createCreativeGroupSchema } from "@/lib/validation/question.schema";

const labels = ["ক", "খ", "গ", "ঘ"] as const;
const levels = ["knowledge", "understanding", "application", "higher_order"] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<AiImportCreativeGroupInput>({
  auth: true,
  organizationPermission: {
    globalPermission: "question:import",
    organizationPermission: "question:import",
  },
  rateLimit: "aiImport",
  bodySchema: aiImportCreativeGroupSchema,
  async handler({ body, user, audit, requestId }) {
    const input = createCreativeGroupSchema.parse({
      ...body,
      parts: body.parts.map((part, index) => ({
        ...part,
        language: body.language === "en" ? "en" : "bn",
        status: "DRAFT",
        source: "AI_GENERATED",
        tags: ["ai-generated"],
        aiGenerated: true,
        creativePartLabel: labels[index]!,
        cognitiveLevel: levels[index]!,
      })),
    });
    const result = await questionService.createCreativeGroup(input, user, audit, {
      permission: "question:import",
      aiGenerated: true,
    });
    return ok({ received: 4, imported: result.questions.length, skipped: 0, ...result }, { status: 201, requestId });
  },
});
