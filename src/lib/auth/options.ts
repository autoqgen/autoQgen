import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { env, googleOAuthEnabled } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { burnPasswordComparison, verifyPassword } from "@/lib/auth/password";
import { DEFAULT_ROLE, isUserRole, isUserStatus, type UserRole, type UserStatus } from "@/types/roles";

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

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "credentials",
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password ?? "";

      if (!email || !password) {
        throw new Error(GENERIC_CREDENTIALS_ERROR);
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

      await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).exec();

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        role: user.role,
        status: user.status,
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
    },

    async jwt({ token, user, trigger }) {
      // Initial sign-in, or an explicit session refresh.
      if (user || trigger === "update" || !token.uid) {
        const email = (user?.email ?? token.email)?.toString().toLowerCase();
        if (email) {
          await connectDB();
          const record = await User.findOne({ email })
            .select("_id name email image role status tokenVersion")
            .lean()
            .exec();

          if (record) {
            token.uid = record._id.toString();
            token.name = record.name;
            token.email = record.email;
            token.picture = record.image || null;
            token.role = record.role;
            token.status = record.status;
            token.tokenVersion = record.tokenVersion;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = isUserRole(token.role) ? (token.role as UserRole) : DEFAULT_ROLE;
        session.user.status = isUserStatus(token.status) ? (token.status as UserStatus) : "active";
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
