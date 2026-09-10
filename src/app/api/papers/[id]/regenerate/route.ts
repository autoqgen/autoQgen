import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperService } from "@/lib/services/paper.service";
import {
  generateAndSavePaperSchema,
  type GenerateAndSavePaperInput,
} from "@/lib/validation/paper.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Regenerate a generated paper from edited settings. Updates the SAME paper in
 * place — new questions and persisted config, no new document, no version.
 *
 * `paper:create` is checked inside `paperService.regenerate()`; the
 * organization / category / subject are taken from the paper — the client can
 * only change the filter settings.
 */
export const POST = defineRoute<GenerateAndSavePaperInput, RouteIdParams>({
  auth: true,
  rateLimit: "paperGenerate",
  paramsSchema: routeIdParamsSchema,
  bodySchema: generateAndSavePaperSchema,
  async handler({ params, body, user, audit, requestId }) {
    const { paper, warnings, result } = await paperService.regenerate(params.id, body, user, audit);
    return ok({ paper, warnings, result }, { requestId });
  },
});
