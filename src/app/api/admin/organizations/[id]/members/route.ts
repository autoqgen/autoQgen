import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { organizationMemberService } from "@/lib/services/organization-member.service";
import { memberListQuerySchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Super Admin cross-org member view — permission already scoped platform-wide. */
export const GET = defineRoute({
  auth: true,
  permission: "organization:manage",
  paramsSchema: routeIdParamsSchema,
  querySchema: memberListQuerySchema,
  async handler({ params, query, requestId }) {
    const { items, total } = await organizationMemberService.list(params.id, query);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});
