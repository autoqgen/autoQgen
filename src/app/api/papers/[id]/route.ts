import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { paperService } from "@/lib/services/paper.service";
import { updatePaperSchema, type UpdatePaperInput } from "@/lib/validation/paper.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "paper:read",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, requestId }) {
    return ok(await paperService.getById(params.id, user), { requestId });
  },
});

/** Ownership and archived-state rules are enforced in the service. */
export const PUT = defineRoute<UpdatePaperInput, RouteIdParams>({
  auth: true,
  permission: "paper:read",
  rateLimit: "paperCreate",
  paramsSchema: routeIdParamsSchema,
  bodySchema: updatePaperSchema,
  async handler({ params, body, user, audit, requestId }) {
    return ok(await paperService.update(params.id, body, user, audit), { requestId });
  },
});

export const DELETE = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "paper:read",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    await paperService.remove(params.id, user, audit);
    return ok({ id: params.id, deactivated: true }, { requestId });
  },
});
