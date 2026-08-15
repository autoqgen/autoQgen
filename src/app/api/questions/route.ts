import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { questionService } from "@/lib/services/question.service";
import {
  createQuestionSchema,
  questionListQuerySchema,
  type CreateQuestionInput,
  type QuestionListQuery,
} from "@/lib/validation/question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List questions.
 *
 * Always paginated with a hard ceiling of 100 (see paginationQuerySchema), and
 * answer keys are stripped unless the caller both asks for them and holds
 * `question:read-answers`.
 */
export const GET = defineRoute<undefined, undefined, QuestionListQuery>({
  auth: true,
  permission: "question:read",
  querySchema: questionListQuerySchema,
  async handler({ query, user, requestId }) {
    const { items, total } = await questionService.list(query, user);
    return ok(items, {
      requestId,
      meta: buildPaginationMeta(query.page, query.limit, total),
    });
  },
});

/**
 * Create a question.
 *
 * `createdBy` is taken from the authenticated session. It is not part of
 * `createQuestionSchema`, so a `createdBy` key in the request body is stripped
 * before the service ever sees it.
 */
export const POST = defineRoute<CreateQuestionInput>({
  auth: true,
  permission: "question:create",
  rateLimit: "questionCreate",
  bodySchema: createQuestionSchema,
  async handler({ body, user, audit, requestId }) {
    const created = await questionService.create(body, user, audit);
    return ok(created, { status: 201, requestId });
  },
});
