import { Schema, Types, model, models, type Model } from "mongoose";

/**
 * Password reset tokens, stored in MongoDB.
 *
 * The previous project kept these in `data/passwordReset.json` and wrote the new
 * password to `data/users.json` while login read from MongoDB — so a completed
 * reset silently did nothing and locked the user out. The token cryptography
 * from that implementation was sound and is preserved: 32 random bytes issued to
 * the user, only the SHA-256 hash persisted, one hour expiry, single use.
 *
 * A TTL index expires documents automatically, so no cleanup job is required.
 */

export interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** SHA-256 of the raw token. The raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  requestedIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    requestedIp: {
      type: String,
      maxlength: 64,
    },
  },
  { timestamps: true },
);

// Mongo removes the document once expiresAt passes.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast lookup of the active token for a user.
PasswordResetTokenSchema.index({ userId: 1, usedAt: 1, expiresAt: -1 });

export const PasswordResetToken: Model<IPasswordResetToken> =
  (models.PasswordResetToken as Model<IPasswordResetToken>) ??
  model<IPasswordResetToken>("PasswordResetToken", PasswordResetTokenSchema);

export default PasswordResetToken;
