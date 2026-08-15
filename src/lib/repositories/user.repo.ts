import { Types } from "mongoose";

import { User, type IUser } from "@/models";
import type { UserRole, UserStatus } from "@/types/roles";

/**
 * All User data access. Nothing outside this module calls the User model
 * directly, so "who is allowed to read the password hash" is answerable by
 * reading one file.
 */

export type PublicUser = Pick<
  IUser,
  "name" | "email" | "image" | "role" | "status" | "emailVerified" | "createdAt" | "lastLoginAt"
> & { id: string };

const PUBLIC_FIELDS = "_id name email image role status emailVerified createdAt lastLoginAt";

function toPublicUser(doc: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}): PublicUser {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    image: doc.image ?? "",
    role: doc.role,
    status: doc.status,
    emailVerified: doc.emailVerified,
    createdAt: doc.createdAt,
    lastLoginAt: doc.lastLoginAt,
  };
}

export const userRepository = {
  async findByEmail(email: string): Promise<PublicUser | null> {
    const doc = await User.findOne({ email: email.toLowerCase() }).select(PUBLIC_FIELDS).lean().exec();
    return doc ? toPublicUser(doc) : null;
  },

  async existsByEmail(email: string): Promise<boolean> {
    const doc = await User.exists({ email: email.toLowerCase() }).exec();
    return Boolean(doc);
  },

  async findPublicById(id: string | Types.ObjectId): Promise<PublicUser | null> {
    const doc = await User.findById(id).select(PUBLIC_FIELDS).lean().exec();
    return doc ? toPublicUser(doc) : null;
  },

  /**
   * The only repository method that returns the password hash. Callers are
   * limited to the credentials provider and the change-password service.
   */
  async findWithPasswordById(
    id: string | Types.ObjectId,
  ): Promise<{ _id: Types.ObjectId; password?: string } | null> {
    return User.findById(id).select("+password _id").lean().exec();
  },

  async create(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
  }): Promise<PublicUser> {
    const created = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.passwordHash,
      role: input.role,
      status: input.status,
    });

    return toPublicUser(created.toObject() as unknown as Parameters<typeof toPublicUser>[0]);
  },

  async updateName(id: string | Types.ObjectId, name: string): Promise<PublicUser | null> {
    const doc = await User.findByIdAndUpdate(id, { $set: { name } }, { new: true })
      .select(PUBLIC_FIELDS)
      .lean()
      .exec();
    return doc ? toPublicUser(doc) : null;
  },

  /** Sets a new hash and revokes every outstanding session for that user. */
  async setPassword(id: string | Types.ObjectId, passwordHash: string): Promise<boolean> {
    const result = await User.updateOne(
      { _id: id },
      { $set: { password: passwordHash }, $inc: { tokenVersion: 1 } },
    ).exec();
    return result.modifiedCount === 1;
  },
};

export type UserRepository = typeof userRepository;
