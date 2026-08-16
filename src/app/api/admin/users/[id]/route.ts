import { z } from "zod";
import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { USER_ROLES, USER_STATUSES } from "@/types/roles";
import { auditService } from "@/lib/services/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const PATCH = defineRoute({
  auth: true,
  permission: "user:manage-roles",
  bodySchema,
  async handler({ request, body, user: actor, audit, requestId }) {
    await connectDB();

    // Extract user ID from URL path segment (/api/admin/users/[id])
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];

    if (!id) throw new ValidationError("Missing user ID.");

    const targetUser = await User.findById(id);
    if (!targetUser) throw new NotFoundError("User not found.");

    if (!body.role && !body.status) {
      throw new ValidationError("Must provide role or status to update.");
    }

    const previousRole = targetUser.role;
    const previousStatus = targetUser.status;

    if (body.role) targetUser.role = body.role;
    if (body.status) targetUser.status = body.status;

    await targetUser.save();

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
        updatedAt: targetUser.updatedAt.toISOString(),
      },
      { requestId }
    );
  },
});
