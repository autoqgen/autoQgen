import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { assertPermissionOrOrgMembership } from "@/lib/auth/org-session";
import { questionTemplateService } from "@/lib/services/question-template.service";
import {
  createQuestionTemplateSchema,
  questionTemplateListQuerySchema,
  type CreateQuestionTemplateInput,
  type QuestionTemplateListQuery,
} from "@/lib/validation/question-template.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `template:read` is checked via the org-membership fallback (not a static route
 * permission) so a plain `member` with an active organization membership can
 * browse templates to load one, exactly like the paper-generate routes.
 */
export const GET = defineRoute<undefined, undefined, QuestionTemplateListQuery>({
  auth: true,
  querySchema: questionTemplateListQuerySchema,
  async handler({ query, user, requestId }) {
    await assertPermissionOrOrgMembership(user, "template:read", "template:read");
    const { items, total } = await questionTemplateService.list(query, user);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});

export const POST = defineRoute<CreateQuestionTemplateInput>({
  auth: true,
  permission: "template:manage",
  bodySchema: createQuestionTemplateSchema,
  async handler({ body, user, audit, requestId }) {
    const template = await questionTemplateService.create(body, user, audit);
    return ok(template, { status: 201, requestId });
  },
});
