import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { objectIdSchema } from "@/lib/validation/common";
import { assertTeamPermission, requireCurrentOrganizationId, requireOrgMembership } from "@/lib/auth/org-session";
import { teamService } from "@/lib/services/team.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: objectIdSchema, memberId: objectIdSchema });

/** Assign an existing org member to this team. Organization Owner (any team) or its own Team Admin. */
export const PATCH = defineRoute({
  auth: true,
  paramsSchema,
  async handler({ params, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    const membership = await requireOrgMembership(user, organizationId);
    assertTeamPermission(membership, params.id, "team:members:manage");

    const updated = await teamService.assignMember(organizationId, params.id, params.memberId, audit);
    return ok(updated, { requestId });
  },
});

/** Unassign a member from this team. */
export const DELETE = defineRoute({
  auth: true,
  paramsSchema,
  async handler({ params, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    const membership = await requireOrgMembership(user, organizationId);
    assertTeamPermission(membership, params.id, "team:members:manage");

    const updated = await teamService.unassignMember(organizationId, params.id, params.memberId, audit);
    return ok(updated, { requestId });
  },
});
