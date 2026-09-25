import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperSimilarityService } from "@/lib/services/paper-similarity.service";
import {
  replaceQuestionSchema,
  type ReplaceQuestionInput,
} from "@/lib/validation/paper-similarity.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Remove & Replace" — regenerate a replacement for a flagged question using the
 * existing paper generator, semantically validate it (retry up to 3×), then
 * swap it in. On failure the paper is unchanged. Paper edit rights enforced in
 * the service.
 */
export const POST = defineRoute<ReplaceQuestionInput, RouteIdParams>({
  auth: true,
  organizationPermission: {
    globalPermission: "paper:read",
    organizationPermission: "paper:read",
  },
  rateLimit: "aiGenerate",
  paramsSchema: routeIdParamsSchema,
  bodySchema: replaceQuestionSchema,
  async handler({ params, body, user, audit, requestId }) {
    return ok(await paperSimilarityService.replaceQuestion(params.id, body, user, audit), {
      requestId,
    });
  },
});
