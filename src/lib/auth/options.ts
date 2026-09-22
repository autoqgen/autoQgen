import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { env, googleOAuthEnabled } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { burnPasswordComparison, verifyPassword } from "@/lib/auth/password";
import { DEFAULT_ROLE, isUserRole, isUserStatus, type UserRole, type UserStatus } from "@/types/roles";
import { rateLimit } from "@/lib/rate-limit";
import { EMAIL_NOT_VERIFIED_ERROR } from "@/lib/auth/messages";
import { emailVerificationService } from "@/lib/services/email-verification.service";

/**
 * Auth.js configuration.
 *
 * Lives in lib/ rather than inside the route file so `getServerSession(authOptions)`
 * is callable from middleware helpers, services and server components. The
 * previous project defined its options inside the route handler, which is
 * precisely why no other route could check authentication.
 *
 * There is exactly one authentication system here. The previous project ran a
 * second hand-rolled `jsonwebtoken` flow in parallel that logged its own signing
 * secret; it is not carried over.
 */

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60; // rotate daily

/** Deliberately identical for "no such user" and "wrong password". */
const GENERIC_CREDENTIALS_ERROR = "Invalid email or password.";

function sanitizeImageForToken(image?: string | null, userId?: string | null): string | null {
  if (!image) return null;
  // Base64 data URLs or extremely long strings exceed HTTP header cookie size limits,
  // causing HPE_HEADER_OVERFLOW / client_fetch_error Unexpected end of JSON input on /api/auth/session.
  // Route them through the avatar endpoint so the JWT session cookie stays lightweight.
  if (image.startsWith("data:") || image.length > 500) {
    if (userId) {
      return `/api/users/${userId}/avatar`;
    }
    return "/api/users/me/avatar";
  }
  return image;
}

function getRequestHeader(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;

  if (typeof (headers as { get?: unknown }).get === "function") {
    const value = (headers as { get(name: string): string | null }).get(name);
    return value ?? undefined;
  }

  if (typeof headers === "object") {
    const record = headers as Record<string, string | string[] | undefined>;
    const value = record[name] ?? record[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}


const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "credentials",
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, request) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password ?? "";

      if (!email || !password) {
        throw new Error(GENERIC_CREDENTIALS_ERROR);
      }

      const forwarded = getRequestHeader(request.headers, "x-forwarded-for")?.split(",")[0]?.trim();
      const identifier = forwarded || getRequestHeader(request.headers, "x-real-ip")?.trim() || "unknown";
      const loginLimit = await rateLimit("login", identifier);
      if (!loginLimit.allowed) {
        throw new Error("Too many login attempts. Please try again later.");
      }

      await connectDB();

      // The only place in the application allowed to select the password hash.
      const user = await User.findOne({ email }).select("+password").exec();

      if (!user?.password) {
        // Equalise timing so absence of an account is not observable.
        await burnPasswordComparison(password);
        throw new Error(GENERIC_CREDENTIALS_ERROR);
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        throw new Error(GENERIC_CREDENTIALS_ERROR);
      }

      if (user.status === "suspended") {
        throw new Error("This account has been suspended. Contact an administrator.");
      }

      if (!user.emailVerified) {
        try {
          await emailVerificationService.issue({
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          });
        } catch (error) {
          logger.error("Failed to send automatic email verification", {
            userId: user._id.toString(),
            error,
          });
        }
        throw new Error(EMAIL_NOT_VERIFIED_ERROR);
      }

      await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).exec();

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: sanitizeImageForToken(user.image, user._id.toString()),
        role: user.role,
        status: user.status,
        organizationId: user.organization ? user.organization.toString() : null,
      };
    },
  }),
];


if (googleOAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: false,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Google sign-in must resolve to a real MongoDB User document.
     *
     * The previous project persisted nothing for Google users, so their session
     * id was a Google subject identifier and every ObjectId validation rejected
     * them. Linking happens only on a provider-verified email address.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      const emailVerified =
        typeof profile === "object" &&
        profile !== null &&
        "email_verified" in profile &&
        (profile as { email_verified?: boolean }).email_verified === true;

      if (!emailVerified) {
        logger.warn("Rejected Google sign-in with unverified email", { provider: "google" });
        return false;
      }

      try {
        await connectDB();

        const existing = await User.findOne({ email }).exec();

        if (existing) {
          if (existing.status === "suspended") return false;
          await User.updateOne(
            { _id: existing._id },
            {
              $set: {
                emailVerified: existing.emailVerified ?? new Date(),
                image: existing.image || user.image || "",
                lastLoginAt: new Date(),
              },
            },
          ).exec();
          return true;
        }

        await User.create({
          name: user.name?.trim() || email.split("@")[0],
          email,
          image: user.image ?? "",
          // Role is never derived from the provider payload.
          role: DEFAULT_ROLE,
          status: "active",
          emailVerified: new Date(),
          lastLoginAt: new Date(),
        });

        return true;
      } catch (error) {
        logger.error("Error during Google sign-in callback", { error, email });
        return false;
      }
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.status = user.status;
        token.organizationId = user.organizationId ?? null;
        token.picture = sanitizeImageForToken(user.image ?? (user as unknown as { picture?: string }).picture, user.id);
      }

      // Initial sign-in, or an explicit session refresh (also used after
      // switching organizations — the client calls useSession().update()).
      if (user || trigger === "update" || !token.uid) {
        const email = (user?.email ?? token.email)?.toString().toLowerCase();
        if (email) {
          try {
            await connectDB();
            const record = await User.findOne({ email })
              .select("_id name email image role status tokenVersion organization")
              .lean()
              .exec();

            if (record) {
              token.uid = record._id.toString();
              token.name = record.name;
              token.email = record.email;
              token.picture = sanitizeImageForToken(record.image, record._id.toString());
              token.role = record.role;
              token.status = record.status;
              token.tokenVersion = record.tokenVersion;
              token.organizationId = record.organization ? record.organization.toString() : null;
            }
          } catch (error) {
            logger.error("Failed to query user in JWT callback", { error, email });
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.image = (token.picture as string | null) ?? null;
        session.user.role = isUserRole(token.role) ? (token.role as UserRole) : DEFAULT_ROLE;
        session.user.status = isUserStatus(token.status) ? (token.status as UserStatus) : "active";
        session.user.organizationId = typeof token.organizationId === "string" ? token.organizationId : null;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      logger.info("User signed out", { userId: token?.uid });
    },
  },
  debug: false,
};
