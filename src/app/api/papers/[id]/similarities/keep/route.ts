import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperSimilarityService } from "@/lib/services/paper-similarity.service";
import { keepBothSchema, type KeepBothInput } from "@/lib/validation/paper-similarity.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Keep Both" — resolve a flagged pair without touching either question. Paper
 * edit rights are enforced in the service (owner, or `paper:update:any`).
 */
export const POST = defineRoute<KeepBothInput, RouteIdParams>({
  auth: true,
  organizationPermission: {
    globalPermission: "paper:read",
    organizationPermission: "paper:read",
  },
  paramsSchema: routeIdParamsSchema,
  bodySchema: keepBothSchema,
  async handler({ params, body, user, audit, requestId }) {
    return ok(await paperSimilarityService.keepBoth(params.id, body, user, audit), { requestId });
  },
});
