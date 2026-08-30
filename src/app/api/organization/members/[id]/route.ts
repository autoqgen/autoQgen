import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { requireCurrentOrganizationId, requireOrgPermission } from "@/lib/auth/org-session";
import { organizationMemberService } from "@/lib/services/organization-member.service";
import { updateMemberSchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = defineRoute({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  bodySchema: updateMemberSchema,
  async handler({ params, body, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "members:update");

    const updated = await organizationMemberService.updateMember(organizationId, params.id, body, audit);
    return ok(updated, { requestId });
  },
});

export const DELETE = defineRoute({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "members:remove");

    await organizationMemberService.removeMember(organizationId, params.id, audit);
    return ok({ removed: true }, { requestId });
  },
});
