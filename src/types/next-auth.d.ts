import type { DefaultSession } from "next-auth";
import type { UserRole, UserStatus } from "@/types/roles";

/**
 * Auth.js module augmentation.
 *
 * The previous project cast its auth options with `as any` and never propagated
 * `role`, which is why its settings screen displayed every user as
 * "SUPER-ADMIN". Typing the session and JWT properly removes both problems.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
    status: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** MongoDB ObjectId as a string — never a provider subject id. */
    uid: string;
    role: UserRole;
    status: UserStatus;
    /** Bumped on password change / forced logout to revoke outstanding tokens. */
    tokenVersion: number;
  }
}

export {};
