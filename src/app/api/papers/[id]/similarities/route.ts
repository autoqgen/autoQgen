import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperSimilarityService } from "@/lib/services/paper-similarity.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-paper semantic similarity check.
 *
 * GET  — return the current flagged pairs (recomputed from cached embeddings).
 * POST — the "Similarities" button: (re)embed as needed and return the pairs.
 *
 * `paper:read` gates access; the paper is loaded org-scoped in the service, so
 * a user in another organization gets a 404. Comparison is strictly among this
 * paper's own questions.
 */
export const GET = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "paper:read",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, requestId }) {
    return ok(await paperSimilarityService.getReview(params.id, user), { requestId });
  },
});

export const POST = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "paper:read",
  rateLimit: "aiGenerate",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    return ok(await paperSimilarityService.getReview(params.id, user, audit), { requestId });
  },
});
