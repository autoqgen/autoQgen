import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { requireCurrentOrganizationId, requireOrgPermission } from "@/lib/auth/org-session";
import { invitationService } from "@/lib/services/invitation.service";
import { createInvitationSchema, invitationListQuerySchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  querySchema: invitationListQuerySchema,
  async handler({ query, user, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "invitations:manage");

    const { items, total } = await invitationService.listForOrg(organizationId, query);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});

export const POST = defineRoute({
  auth: true,
  bodySchema: createInvitationSchema,
  async handler({ body, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "members:invite");

    const invitation = await invitationService.invite(organizationId, body, user, audit);
    return ok(invitation, { status: 201, requestId });
  },
});
