import { z } from "zod";
import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { connectDB } from "@/lib/db";
import { OrganizationMember, User } from "@/models";
import { objectIdSchema } from "@/lib/validation/common";
import { organizationMemberService } from "@/lib/services/organization-member.service";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { ADMIN_GLOBAL_ROLES, USER_STATUSES } from "@/types/roles";
import { ORG_ROLES } from "@/types/organization";
import { auditService } from "@/lib/services/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const adminUserUpdateSchema = z.object({
  /** Global platform role — always independent of the organization role below. */
  role: z.enum(ADMIN_GLOBAL_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  /**
   * A real organization id assigns/moves the user into it; `null` clears
   * their organization entirely. Omitted (the default) leaves organization
   * membership untouched — existing role/status-only PATCH calls behave
   * exactly as before.
   */
  organizationId: objectIdSchema.nullable().optional(),
  /**
   * The user's role *within* their organization — stored on OrganizationMember,
   * never on User. Applied to `organizationId` when given, otherwise to the
   * user's current organization. `organization_owner` is accepted here (Super
   * Admin only) and triggers the full owner assignment for that organization.
   */
  organizationRole: z.enum(ORG_ROLES).optional(),
});

export const PATCH = defineRoute({
  auth: true,
  permission: "user:manage-roles",
  bodySchema: adminUserUpdateSchema,
  async handler({ request, body, user: actor, audit, requestId }) {
    await connectDB();

    // Extract user ID from URL path segment (/api/admin/users/[id])
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];

    if (!id) throw new ValidationError("Missing user ID.");

    const targetUser = await User.findById(id);
    if (!targetUser) throw new NotFoundError("User not found.");

    if (!body.role && !body.status && body.organizationId === undefined && body.organizationRole === undefined) {
      throw new ValidationError("Must provide role, status, organizationId or organizationRole to update.");
    }

    const previousRole = targetUser.role;
    const previousStatus = targetUser.status;
    const previousOrganizationId = targetUser.organization ? targetUser.organization.toString() : null;
    const previousMembership = previousOrganizationId
      ? await OrganizationMember.findOne({ userId: targetUser._id, organizationId: previousOrganizationId })
          .select("role")
          .lean()
          .exec()
      : null;
    const previousOrganizationRole = previousMembership?.role ?? null;

    // Global role / status are plain User fields, untouched by anything org-related.
    if (body.role) targetUser.role = body.role;
    if (body.status) targetUser.status = body.status;
    await targetUser.save();

    let newOrganizationId = previousOrganizationId;
    let newOrganizationRole = previousOrganizationRole;

    if (body.organizationId !== undefined || body.organizationRole !== undefined) {
      const result = await organizationMemberService.setUserOrganization(
        { userId: targetUser._id, currentOrganizationId: previousOrganizationId },
        { organizationId: body.organizationId, role: body.organizationRole },
        actor,
        audit,
      );
      newOrganizationId = result.organizationId;
      newOrganizationRole = result.organizationRole;
    }

    await auditService.record(
      {
        action: "user.update-role",
        resourceType: "user",
        resourceId: id,
        metadata: {
          targetEmail: targetUser.email,
          targetName: targetUser.name,
          previousRole,
          newRole: targetUser.role,
          previousStatus,
          newStatus: targetUser.status,
          previousOrganizationId,
          newOrganizationId,
          previousOrganizationRole,
          newOrganizationRole,
          updatedBy: actor.id,
        },
      },
      audit
    );

    return ok(
      {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
        organizationId: newOrganizationId,
        organizationRole: newOrganizationRole,
        updatedAt: targetUser.updatedAt.toISOString(),
      },
      { requestId }
    );
  },
});
