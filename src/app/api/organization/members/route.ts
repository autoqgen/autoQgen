import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { requireCurrentOrganizationId, requireOrgPermission } from "@/lib/auth/org-session";
import { organizationMemberService } from "@/lib/services/organization-member.service";
import { memberListQuerySchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  querySchema: memberListQuerySchema,
  async handler({ query, user, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "members:read");

    const { items, total } = await organizationMemberService.list(organizationId, query);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});
