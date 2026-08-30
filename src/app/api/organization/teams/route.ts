import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireCurrentOrganizationId, requireOrgPermission } from "@/lib/auth/org-session";
import { teamService } from "@/lib/services/team.service";
import { createTeamSchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  async handler({ user, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "teams:read");

    const teams = await teamService.list(organizationId);
    return ok(teams, { requestId });
  },
});

export const POST = defineRoute({
  auth: true,
  bodySchema: createTeamSchema,
  async handler({ body, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "teams:create");

    const team = await teamService.create(organizationId, body, user, audit);
    return ok(team, { status: 201, requestId });
  },
});
