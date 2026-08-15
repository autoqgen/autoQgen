import { Types } from "mongoose";

import { PasswordResetToken, type IPasswordResetToken } from "@/models";

export const passwordResetRepository = {
  async create(input: {
    userId: Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    requestedIp?: string;
  }): Promise<void> {
    await PasswordResetToken.create(input);
  },

  /** Invalidates every outstanding token for a user before issuing a new one. */
  async invalidateAllForUser(userId: Types.ObjectId): Promise<void> {
    await PasswordResetToken.updateMany(
      { userId, usedAt: null },
      { $set: { usedAt: new Date() } },
    ).exec();
  },

  async findUsableByHash(tokenHash: string): Promise<IPasswordResetToken | null> {
    return PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .lean()
      .exec();
  },

  /**
   * Atomically marks the token used.
   *
   * The filter repeats the usable conditions so two concurrent requests cannot
   * both consume the same token — only one update matches.
   */
  async consume(tokenHash: string): Promise<boolean> {
    const result = await PasswordResetToken.updateOne(
      { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
    ).exec();
    return result.modifiedCount === 1;
  },
};

export type PasswordResetRepository = typeof passwordResetRepository;
