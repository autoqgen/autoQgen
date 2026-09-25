import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { creativeQuestionService } from "@/lib/services/creative-question.service";
import { createCreativeQuestionSchema, creativeQuestionListQuerySchema, type CreateCreativeQuestionInput, type CreativeQuestionListQuery } from "@/lib/validation/creative-question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute<undefined, undefined, CreativeQuestionListQuery>({
  auth: true,
  organizationPermission: { globalPermission: "question:read", organizationPermission: "question:read" },
  querySchema: creativeQuestionListQuerySchema,
  async handler({ query, user, requestId }) {
    const { items, total } = await creativeQuestionService.list(query, user);
    return ok(items, {
      requestId,
      meta: buildPaginationMeta(query.page, query.limit, total),
    });
  },
});

export const POST = defineRoute<CreateCreativeQuestionInput>({
  auth: true,
  rateLimit: "questionCreate",
  bodySchema: createCreativeQuestionSchema,
  async handler({ body, user, audit, requestId }) {
    return ok(await creativeQuestionService.create(body, user, audit), { status: 201, requestId });
  },
});
