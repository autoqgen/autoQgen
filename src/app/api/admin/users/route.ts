import { z } from "zod";
import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { USER_ROLES, USER_STATUSES } from "@/types/roles";

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
      .select("_id name email role status createdAt updatedAt lastLoginAt")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const formatted = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return ok(formatted, {
      requestId,
      meta: buildPaginationMeta(page, limit, total),
    });
  },
});
