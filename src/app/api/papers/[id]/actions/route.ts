import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperService } from "@/lib/services/paper.service";
import { paperActionSchema, type PaperActionInput } from "@/lib/validation/paper.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lifecycle transitions: publish, archive, restore and clone.
 *
 * Kept on one action endpoint rather than four verbs so the state machine lives
 * in a single place and every transition is audited identically.
 */
export const POST = defineRoute<PaperActionInput, RouteIdParams>({
  auth: true,
  permission: "paper:read",
  rateLimit: "paperCreate",
  paramsSchema: routeIdParamsSchema,
  bodySchema: paperActionSchema,
  async handler({ params, body, user, audit, requestId }) {
    switch (body.action) {
      case "publish":
        return ok(await paperService.changeStatus(params.id, "PUBLISHED", user, audit), {
          requestId,
        });
      case "archive":
        return ok(await paperService.changeStatus(params.id, "ARCHIVED", user, audit), {
          requestId,
        });
      case "restore":
        return ok(await paperService.changeStatus(params.id, "DRAFT", user, audit), { requestId });
      case "clone": {
        const clone = await paperService.clone(params.id, user, audit, body.title);
        return ok(clone, { status: 201, requestId });
      }
    }
  },
});
