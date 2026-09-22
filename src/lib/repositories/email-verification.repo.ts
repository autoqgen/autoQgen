import { Types } from "mongoose";

import { EmailVerificationToken, type IEmailVerificationToken } from "@/models";

export const emailVerificationRepository = {
  async create(input: { userId: Types.ObjectId; tokenHash: string; expiresAt: Date }): Promise<void> {
    await EmailVerificationToken.create(input);
  },

  async invalidateAllForUser(userId: Types.ObjectId): Promise<void> {
    await EmailVerificationToken.updateMany(
      { userId, usedAt: null },
      { $set: { usedAt: new Date() } },
    ).exec();
  },

  async findUsableByHash(tokenHash: string): Promise<IEmailVerificationToken | null> {
    return EmailVerificationToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .lean()
      .exec();
  },

  async consume(tokenHash: string): Promise<boolean> {
    const result = await EmailVerificationToken.updateOne(
      { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
    ).exec();
    return result.modifiedCount === 1;
  },
};