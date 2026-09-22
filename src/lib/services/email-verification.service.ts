import { Types } from "mongoose";

import { env } from "@/lib/config/env";
import { sendEmail } from "@/lib/email";
import { emailVerificationEmail } from "@/lib/email/templates/verification";
import { emailVerificationRepository } from "@/lib/repositories/email-verification.repo";
import { userRepository } from "@/lib/repositories/user.repo";
import { randomToken, sha256 } from "@/lib/security/hash";
import { logger } from "@/lib/logger";
import { EMAIL_VERIFICATION_TTL_MINUTES } from "@/lib/auth/verification";

const TOKEN_TTL_MS = EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000;

export const emailVerificationService = {
  buildVerificationUrl(token: string): string {
    const base = env.NEXTAUTH_URL.replace(/\/$/, "");
    return `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  },

  async issue(user: { id: string; email: string; name: string }): Promise<void> {
    const token = randomToken(32);
    await emailVerificationRepository.invalidateAllForUser(new Types.ObjectId(user.id));
    await emailVerificationRepository.create({
      userId: new Types.ObjectId(user.id),
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const result = await sendEmail(
      emailVerificationEmail({
        recipientEmail: user.email,
        recipientName: user.name,
        verificationUrl: this.buildVerificationUrl(token),
        expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
      }),
    );
    logger.info("Email verification token issued", { userId: user.id, delivered: result.delivered });
  },

  async resend(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user || user.emailVerified) return;
    await this.issue(user);
  },

  async verify(token: string): Promise<boolean> {
    const record = await emailVerificationRepository.findUsableByHash(sha256(token));
    if (!record) return false;

    const consumed = await emailVerificationRepository.consume(record.tokenHash);
    if (!consumed) return false;

    const user = await userRepository.markEmailVerified(record.userId);
    return Boolean(user);
  },
};