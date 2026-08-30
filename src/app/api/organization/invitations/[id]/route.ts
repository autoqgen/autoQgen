import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { requireCurrentOrganizationId, requireOrgPermission } from "@/lib/auth/org-session";
import { invitationService } from "@/lib/services/invitation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = defineRoute({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "invitations:manage");

    await invitationService.cancel(organizationId, params.id, audit);
    return ok({ cancelled: true }, { requestId });
  },
});
