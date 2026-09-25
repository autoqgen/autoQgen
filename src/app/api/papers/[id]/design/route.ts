import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperService } from "@/lib/services/paper.service";
import { paperDesignSchema, type PaperDesignInput } from "@/lib/validation/paper.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save the paper's appearance / output ("Design") configuration.
 *
 * Persists `designConfig` only — it never regenerates questions, touches
 * QuestionUsage, or bumps the paper version. Ownership / organization scope is
 * enforced in `paperService.updateDesign`.
 */
export const PATCH = defineRoute<PaperDesignInput, RouteIdParams>({
  auth: true,
  organizationPermission: {
    globalPermission: "paper:read",
    organizationPermission: "paper:read",
  },
  rateLimit: "paperCreate",
  paramsSchema: routeIdParamsSchema,
  bodySchema: paperDesignSchema,
  async handler({ params, body, user, audit, requestId }) {
    const paper = await paperService.updateDesign(params.id, body, user, audit);
    return ok({ id: paper._id.toString(), designConfig: paper.designConfig }, { requestId });
  },
});
