import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { paperService } from "@/lib/services/paper.service";
import {
  createPaperSchema,
  paperListQuerySchema,
  type CreatePaperInput,
  type PaperListQuery,
} from "@/lib/validation/paper.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute<undefined, undefined, PaperListQuery>({
  auth: true,
  organizationPermission: {
    globalPermission: "paper:read",
    organizationPermission: "paper:read",
  },
  querySchema: paperListQuerySchema,
  async handler({ query, user, requestId }) {
    const { items, total } = await paperService.list(query, user);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});

/**
 * Manual paper creation.
 *
 * `createdBy`, `totalMarks`, `totalQuestions`, `version` and `status` are all
 * server-derived — none appears in `createPaperSchema`, so they cannot be
 * supplied by a client.
 */
/** paper:create is checked inside paperService.create() — a plain "member" role can gain it via active organization membership (see assertPermissionOrOrgMembership), so it can't be a static route-level permission. */
export const POST = defineRoute<CreatePaperInput>({
  auth: true,
  rateLimit: "paperCreate",
  bodySchema: createPaperSchema,
  async handler({ body, user, audit, requestId }) {
    const paper = await paperService.create(body, user, audit);
    return ok(paper, { status: 201, requestId });
  },
});
