import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireCurrentOrganizationId, requireOrgPermission, resolveCurrentOrganizationId, getMembership } from "@/lib/auth/org-session";
import { organizationRepository } from "@/lib/repositories/organization.repo";
import { organizationMemberService } from "@/lib/services/organization-member.service";
import { organizationService } from "@/lib/services/organization.service";
import { shortTextSchema } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The caller's current organization + their own membership, or nulls if they have none. */
export const GET = defineRoute({
  auth: true,
  async handler({ user, requestId }) {
    const organizationId = await resolveCurrentOrganizationId(user);
    const memberships = await organizationMemberService.listMineWithOrganization(user);

    if (!organizationId) {
      return ok({ organization: null, membership: null, memberships }, { requestId });
    }

    const [org, membership] = await Promise.all([
      organizationRepository.findById(organizationId),
      getMembership(user.objectId, organizationId),
    ]);

    return ok(
      {
        organization: org ? { id: org._id.toString(), name: org.name, slug: org.slug, isActive: org.isActive } : null,
        membership: membership ? { role: membership.role, teamId: membership.teamId?.toString() ?? null } : null,
        memberships,
      },
      { requestId },
    );
  },
});

const updateNameSchema = z.object({ name: shortTextSchema(160, "Organization name") });

/**
 * The Organization Owner may rename their own organization. Slug and
 * active/suspended status stay Super-Admin-only (see
 * /api/admin/organizations/[id]) — this route intentionally accepts nothing
 * else.
 */
export const PATCH = defineRoute({
  auth: true,
  bodySchema: updateNameSchema,
  async handler({ body, user, audit, requestId }) {
    const organizationId = await requireCurrentOrganizationId(user);
    await requireOrgPermission(user, organizationId, "organization:update");

    const updated = await organizationService.update(organizationId, { name: body.name }, audit);
    return ok(updated, { requestId });
  },
});
