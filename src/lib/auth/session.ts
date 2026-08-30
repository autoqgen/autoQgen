import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/lib/auth/options";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors/app-error";
import { can, type Permission } from "@/lib/auth/rbac";
import type { UserRole, UserStatus } from "@/types/roles";

/**
 * The authenticated actor, as trusted by the server.
 *
 * `id` and `role` are re-read from MongoDB on every call rather than taken from
 * the JWT alone. That costs one indexed `_id` lookup per request and buys three
 * things the previous project lacked: suspension takes effect immediately, a
 * role downgrade takes effect immediately, and a password change revokes
 * outstanding tokens through `tokenVersion`.
 */
export interface AuthContext {
  id: string;
  objectId: Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  role: UserRole;
  status: UserStatus;
  /** The user's current organization context, re-read from MongoDB, or null. */
  organizationId: string | null;
}

export async function getOptionalUser(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId || !Types.ObjectId.isValid(userId)) return null;

  await connectDB();

  const record = await User.findById(userId)
    .select("_id name email image role status organization")
    .lean()
    .exec();

  if (!record) return null;
  if (record.status === "suspended") return null;

  return {
    id: record._id.toString(),
    objectId: record._id,
    email: record.email,
    name: record.name,
    image: record.image
      ? record.image.startsWith("data:") || record.image.length > 500
        ? `/api/users/${record._id.toString()}/avatar`
        : record.image
      : "",
    role: record.role,
    status: record.status,
    organizationId: record.organization ? record.organization.toString() : null,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const user = await getOptionalUser();
  if (!user) throw new UnauthorizedError();
  if (user.status !== "active") {
    throw new ForbiddenError("Your account is not active. Contact an administrator.");
  }
  return user;
}

export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const user = await requireAuth();
  if (!can(user.role, permission)) {
    throw new ForbiddenError();
  }
  return user;
}

export async function requireRole(roles: readonly UserRole[]): Promise<AuthContext> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

/** Throws unless the actor holds the permission. Used inside services. */
export function assertPermission(user: AuthContext, permission: Permission): void {
  if (!can(user.role, permission)) {
    throw new ForbiddenError();
  }
}
