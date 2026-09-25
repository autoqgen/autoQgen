import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { questionService } from "@/lib/services/question.service";
import {
  aiImportQuestionsSchema,
  type AiImportQuestionsInput,
} from "@/lib/validation/ai-question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persist the user's selected AI-generated questions.
 *
 * Final server-side gate: `question:import`, organization resolved from the
 * session, taxonomy re-validated, every row re-validated and de-duplicated
 * against this organization's bank, and imported as DRAFT (never auto-approved).
 *
 * Responds 207 when some rows were skipped so the client can tell a clean
 * import from a partial one without parsing the body.
 */
export const POST = defineRoute<AiImportQuestionsInput>({
  auth: true,
  organizationPermission: {
    globalPermission: "question:import",
    organizationPermission: "question:import",
  },
  rateLimit: "aiImport",
  bodySchema: aiImportQuestionsSchema,
  async handler({ body, user, audit, requestId }) {
    const result = await questionService.aiImport(body, user, audit);
    return ok(result, { status: result.skipped > 0 ? 207 : 201, requestId });
  },
});
