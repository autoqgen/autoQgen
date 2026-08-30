import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { assertTeamPermission, requireCurrentOrganizationId, requireOrgMembership, requireOrgPermission } from "@/lib/auth/org-session";
import { teamService } from "@/lib/services/team.service";
import { updateTeamSchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Updating a team's own details is available to the Organization Owner (any
 * team) or the Team Admin assigned to *this* team only — the `:own`/`:any`
 * split already used elsewhere in this codebase (e.g. question:update:own vs
 * :any), expressed here as `team:update` (own-team) vs `teams:update`
 * (org-wide, owner only — see DELETE below, which stays owner-only).
 */
export const PATCH = defineRoute({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  bodySchema: updateTeamSchema,
  async handler({ params, body, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    const membership = await requireOrgMembership(user, organizationId);
    assertTeamPermission(membership, params.id, "team:update");

    const updated = await teamService.update(organizationId, params.id, body, audit);
    return ok(updated, { requestId });
  },
});

/** Deleting the team entity itself stays an Organization Owner action. */
export const DELETE = defineRoute({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "teams:remove");

    await teamService.remove(organizationId, params.id, audit);
    return ok({ removed: true }, { requestId });
  },
});
