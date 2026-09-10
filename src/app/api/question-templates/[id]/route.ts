import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertPermissionOrOrgMembership } from "@/lib/auth/org-session";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { questionTemplateService } from "@/lib/services/question-template.service";
import {
  updateQuestionTemplateSchema,
  type UpdateQuestionTemplateInput,
} from "@/lib/validation/question-template.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute<undefined, RouteIdParams>({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, requestId }) {
    await assertPermissionOrOrgMembership(user, "template:read", "template:read");
    return ok(await questionTemplateService.getById(params.id, user), { requestId });
  },
});

export const PUT = defineRoute<UpdateQuestionTemplateInput, RouteIdParams>({
  auth: true,
  permission: "template:manage",
  paramsSchema: routeIdParamsSchema,
  bodySchema: updateQuestionTemplateSchema,
  async handler({ params, body, user, audit, requestId }) {
    return ok(await questionTemplateService.update(params.id, body, user, audit), { requestId });
  },
});

export const DELETE = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "template:manage",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    await questionTemplateService.remove(params.id, user, audit);
    return ok({ id: params.id, deleted: true }, { requestId });
  },
});
