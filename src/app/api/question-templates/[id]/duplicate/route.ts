import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { questionTemplateService } from "@/lib/services/question-template.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "template:manage",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    const template = await questionTemplateService.duplicate(params.id, user, audit);
    return ok(template, { status: 201, requestId });
  },
});
