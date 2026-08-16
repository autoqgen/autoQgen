import { ConflictError, NotFoundError, UnauthorizedError } from "@/lib/errors/app-error";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { userRepository, type PublicUser } from "@/lib/repositories/user.repo";
import { logger } from "@/lib/logger";
import { DEFAULT_ROLE } from "@/types/roles";
import type { AuthContext } from "@/lib/auth/session";
import type {
  ChangePasswordInput,
  RegisterInput,
  UpdateProfileInput,
} from "@/lib/validation/auth.schema";

/**
 * Account lifecycle.
 *
 * The role assigned at registration is a server-side constant. It is never read
 * from input, and `registerSchema` does not even accept a `role` key — the
 * previous project passed `role` straight from the request body into
 * `User.create()`, so anyone could self-provision `super_admin`.
 */

export const authService = {
  async register(input: RegisterInput): Promise<PublicUser> {
    const email = input.email.toLowerCase();

    if (await userRepository.existsByEmail(email)) {
      // Registration is not an enumeration oracle worth protecting to the same
      // degree as login — a user must be told their email is taken to proceed —
      // but the message deliberately reveals nothing beyond that.
      throw new ConflictError("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      name: input.name,
      email,
      passwordHash,
      role: DEFAULT_ROLE,
      status: "active",
    });

    logger.info("Account registered", { userId: user.id, role: user.role });

    return user;
  },

  async getProfile(actor: AuthContext): Promise<PublicUser> {
    const user = await userRepository.findPublicById(actor.objectId);
    if (!user) throw new NotFoundError("User");
    return user;
  },

  async updateProfile(actor: AuthContext, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await userRepository.updateProfile(actor.objectId, input);
    if (!user) throw new NotFoundError("User");
    return user;
  },

  /**
   * Changing a password bumps `tokenVersion`, which invalidates every session
   * issued before the change.
   */
  async changePassword(actor: AuthContext, input: ChangePasswordInput): Promise<void> {
    const record = await userRepository.findWithPasswordById(actor.objectId);

    if (!record?.password) {
      // Google-only accounts have no password to change.
      throw new UnauthorizedError(
        "This account signs in with Google and has no password to change.",
      );
    }

    const valid = await verifyPassword(input.currentPassword, record.password);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    const newHash = await hashPassword(input.newPassword);
    await userRepository.setPassword(actor.objectId, newHash);

    logger.info("Password changed", { userId: actor.id });
  },
};

export type AuthService = typeof authService;
