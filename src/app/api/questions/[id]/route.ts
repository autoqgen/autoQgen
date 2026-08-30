import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import { questionService } from "@/lib/services/question.service";
import {
  questionDetailQuerySchema,
  updateQuestionSchema,
  type QuestionDetailQuery,
  type UpdateQuestionInput,
} from "@/lib/validation/question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** question:read is checked inside questionService.getById() — see the same route's list-endpoint comment. */
export const GET = defineRoute<undefined, RouteIdParams, QuestionDetailQuery>({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  querySchema: questionDetailQuerySchema,
  async handler({ params, query, user, requestId }) {
    const question = await questionService.getById(params.id, user, {
      requestAnswers: query.withAnswers === true,
      organizationId: query.organizationId,
    });
    return ok(question, { requestId });
  },
});

/** Ownership and role are both enforced inside the service. */
export const PUT = defineRoute<UpdateQuestionInput, RouteIdParams>({
  auth: true,
  permission: "question:read",
  paramsSchema: routeIdParamsSchema,
  bodySchema: updateQuestionSchema,
  async handler({ params, body, user, audit, requestId }) {
    const updated = await questionService.update(params.id, body, user, audit);
    return ok(updated, { requestId });
  },
});

/** Soft delete — the row is deactivated, never destroyed. */
export const DELETE = defineRoute<undefined, RouteIdParams>({
  auth: true,
  permission: "question:read",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    await questionService.remove(params.id, user, audit);
    return ok({ id: params.id, deactivated: true }, { requestId });
  },
});
