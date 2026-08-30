import { z } from "zod";
import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { connectDB } from "@/lib/db";
import { OrganizationMember, User } from "@/models";
import { USER_ROLES, USER_STATUSES } from "@/types/roles";
import type { OrgRole } from "@/types/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
});

export const GET = defineRoute({
  auth: true,
  permission: "user:read:any",
  querySchema,
  async handler({ query, requestId }) {
    await connectDB();

    const { page, limit, search, role, status, sort } = query;
    const filter: Record<string, unknown> = {};

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
      ];
    }

    const sortOption: Record<string, 1 | -1> =
      sort === "oldest"
        ? { createdAt: 1 }
        : sort === "name"
          ? { name: 1 }
          : { createdAt: -1 };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("_id name email role status organization createdAt updatedAt lastLoginAt")
      .populate("organization", "name")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    // The role a user holds *inside* their current organization lives on
    // OrganizationMember, not User — one batched lookup for the whole page.
    const activeMemberships = await OrganizationMember.find({
      userId: { $in: users.map((u) => u._id) },
      status: "active",
    })
      .select("userId organizationId role")
      .lean()
      .exec();

    const orgRoleByUser = new Map<string, { organizationId: string; role: OrgRole }>();
    for (const membership of activeMemberships) {
      orgRoleByUser.set(membership.userId.toString(), {
        organizationId: membership.organizationId.toString(),
        role: membership.role,
      });
    }

    const formatted = users.map((u) => {
      const organization = u.organization as unknown as { _id: unknown; name?: string } | null;
      const organizationId = organization ? String(organization._id) : null;
      const membership = orgRoleByUser.get(u._id.toString());
      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        organizationId,
        organizationName: organization?.name ?? null,
        organizationRole:
          membership && membership.organizationId === organizationId ? membership.role : null,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      };
    });

    return ok(formatted, {
      requestId,
      meta: buildPaginationMeta(page, limit, total),
    });
  },
});
