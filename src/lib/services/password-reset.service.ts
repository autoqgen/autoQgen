import { Types } from "mongoose";

import { env, exposeResetUrlInLogs } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { randomToken, sha256 } from "@/lib/security/hash";
import { hashPassword } from "@/lib/auth/password";
import { passwordResetRepository } from "@/lib/repositories/password-reset.repo";
import { userRepository } from "@/lib/repositories/user.repo";
import { User } from "@/models";
import { ValidationError } from "@/lib/errors/app-error";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates/password-reset";
import type { ForgotPasswordInput, ResetPasswordInput } from "@/lib/validation/auth.schema";

/**
 * Password reset.
 *
 * This is a full rewrite of the previous project's single worst defect: it wrote
 * the new password hash into `data/users.json` while authentication read from
 * MongoDB, so a "successful" reset silently did nothing and permanently locked
 * out anyone who had genuinely forgotten their password.
 *
 * What is preserved is the token cryptography, which was sound: 32 random bytes
 * given to the user, only the SHA-256 hash stored, one-hour expiry, single use,
 * and prior tokens invalidated on reissue.
 *
 * What changed: MongoDB storage with a TTL index, an atomic single-use consume,
 * the password written to the actual User document, all outstanding sessions
 * revoked, and a response that is byte-identical whether or not the email
 * belongs to an account.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_TTL_MINUTES = TOKEN_TTL_MS / 60_000;

export interface ForgotPasswordResult {
  /** Always the same message. Never indicates whether the account exists. */
  message: string;
}

export const passwordResetService = {
  buildResetUrl(token: string): string {
    const base = env.NEXTAUTH_URL.replace(/\/$/, "");
    return `${base}/reset?token=${encodeURIComponent(token)}`;
  },

  async requestReset(
    input: ForgotPasswordInput,
    context: { ip?: string },
  ): Promise<ForgotPasswordResult> {
    const genericResponse: ForgotPasswordResult = {
      message: "If an account exists for that email, reset instructions have been sent.",
    };

    const user = await userRepository.findByEmail(input.email);

    // Silently stop for unknown or suspended accounts. The previous project
    // issued a token and sent mail to whatever address was supplied, which made
    // it an email-bombing relay for arbitrary third parties.
    if (!user || user.status === "suspended") {
      logger.info("Password reset requested for non-actionable account");
      return genericResponse;
    }

    const token = randomToken(32);
    const tokenHash = sha256(token);
    const userId = new Types.ObjectId(user.id);

    await passwordResetRepository.invalidateAllForUser(userId);
    await passwordResetRepository.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      requestedIp: context.ip,
    });

    const resetUrl = this.buildResetUrl(token);

    /**
     * Delivery is best-effort and never changes the response.
     *
     * A transport failure must not be observable, or the endpoint becomes an
     * account-enumeration oracle again — which is exactly the defect the Step 1
     * audit recorded against the previous implementation.
     */
    const result = await sendEmail(
      passwordResetEmail({
        recipientEmail: user.email,
        recipientName: user.name,
        resetUrl,
        expiresInMinutes: TOKEN_TTL_MINUTES,
        supportEmail: env.EMAIL_SUPPORT,
      }),
    );

    if (exposeResetUrlInLogs) {
      // Development convenience only; forced off in production.
      logger.warn("DEV ONLY — password reset URL", { resetUrl });
    }

    logger.info("Password reset token issued", {
      userId: user.id,
      delivered: result.delivered,
    });

    return genericResponse;
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = sha256(input.token);

    const record = await passwordResetRepository.findUsableByHash(tokenHash);
    if (!record) {
      throw new ValidationError("This reset link is invalid or has expired. Request a new one.");
    }

    // Atomic consume: a second concurrent request cannot match the same filter.
    const consumed = await passwordResetRepository.consume(tokenHash);
    if (!consumed) {
      throw new ValidationError("This reset link has already been used. Request a new one.");
    }

    const user = await User.findById(record.userId).select("_id status").lean().exec();
    if (!user || user.status === "suspended") {
      throw new ValidationError("This reset link is invalid or has expired. Request a new one.");
    }

    const passwordHash = await hashPassword(input.password);

    // Writes to the real User document, and bumps tokenVersion so every session
    // issued before the reset stops working.
    const updated = await userRepository.setPassword(record.userId, passwordHash);
    if (!updated) {
      throw new ValidationError("Password could not be updated. Request a new reset link.");
    }

    // Notify the account owner so an unexpected reset is noticed immediately.
    const owner = await userRepository.findPublicById(record.userId);
    if (owner) {
      await sendEmail(
        passwordChangedEmail({
          recipientEmail: owner.email,
          recipientName: owner.name,
          supportEmail: env.EMAIL_SUPPORT,
        }),
      );
    }

    logger.info("Password reset completed", { userId: record.userId.toString() });
  },
};

export type PasswordResetService = typeof passwordResetService;
