import { z } from "zod";

/**
 * Typed, validated environment configuration.
 *
 * This is the ONLY module permitted to read `process.env` directly (enforced by
 * an ESLint rule). Everything else imports `env` from here, so a missing or
 * malformed variable fails loudly at startup rather than producing an
 * undefined-shaped runtime bug deep inside a request.
 *
 * Secret VALUES are never logged. Only variable NAMES appear in error output.
 */

const isProduction = process.env.NODE_ENV === "production";
const isTestEnv = process.env.NODE_ENV === "test";

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "boolean" ? value : ["1", "true", "yes", "on"].includes(value.toLowerCase()),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .refine(
        (value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "MONGODB_URI must start with mongodb:// or mongodb+srv://",
      ),
    MONGODB_DB_NAME: z.string().min(1).optional(),

    NEXTAUTH_SECRET: z
      .string()
      .min(32, "NEXTAUTH_SECRET must be at least 32 characters (openssl rand -base64 32)"),
    NEXTAUTH_URL: z
      .string()
      .url("NEXTAUTH_URL must be an absolute URL, e.g. https://app.example.com"),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    AUTH_DEBUG_RESET_URL: booleanish.default(false),

    // --- Email delivery (Step 2). Leave SMTP_HOST empty to use the console
    // transport in development; production logs an error if it is missing.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: booleanish.default(false),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    EMAIL_FROM: z.string().default("AutoQgen <no-reply@autoqgen.local>"),
    EMAIL_SUPPORT: z.string().email().optional(),

    // --- Security (Step 2)
    // Extra origins permitted to make state-changing requests, comma separated.
    ALLOWED_ORIGINS: z.string().optional(),

    // --- Rate limiting (Step 2). When set, the Redis store replaces the
    // in-memory one so counters are shared across instances.
    REDIS_URL: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasId = Boolean(value.GOOGLE_CLIENT_ID);
    const hasSecret = Boolean(value.GOOGLE_CLIENT_SECRET);
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_USER"],
        message: "SMTP_USER and SMTP_PASSWORD must be set together.",
      });
    }

    if (hasId !== hasSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together, or both left empty to disable Google sign-in.",
      });
    }

    if (value.NODE_ENV === "production") {
      if (value.NEXTAUTH_URL.startsWith("http://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXTAUTH_URL"],
          message: "NEXTAUTH_URL must use https in production.",
        });
      }
      if (value.NEXTAUTH_URL.includes("localhost") || value.NEXTAUTH_URL.includes("127.0.0.1")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["NEXTAUTH_URL"],
          message: "NEXTAUTH_URL must not point at localhost in production.",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const source = {
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
    LOG_LEVEL: process.env.LOG_LEVEL,
    AUTH_DEBUG_RESET_URL: process.env.AUTH_DEBUG_RESET_URL,
    SMTP_HOST: process.env.SMTP_HOST || undefined,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER || undefined,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_SUPPORT: process.env.EMAIL_SUPPORT || undefined,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || undefined,
    REDIS_URL: process.env.REDIS_URL || undefined,
  };

  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    // Report variable NAMES and messages only — never values.
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration.\n${details}\n\n` +
        `Copy .env.example to .env.local and provide the missing values.`,
    );
  }

  return parsed.data;
}

/**
 * Unit tests import modules that transitively depend on config. They should not
 * need a full production environment exported to run. Integration tests set the
 * real values explicitly in tests/setup.ts.
 */
function loadEnvSafe(): Env {
  if (!isTestEnv) return loadEnv();
  try {
    return loadEnv();
  } catch {
    return envSchema.parse({
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://127.0.0.1:27017/autoqgen-test",
      NEXTAUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      NEXTAUTH_URL: "http://localhost:3000",
      LOG_LEVEL: "error",
      AUTH_DEBUG_RESET_URL: false,
      EMAIL_FROM: "AutoQgen <no-reply@autoqgen.local>",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
    });
  }
}

export const env: Env = loadEnvSafe();

export const isProd = isProduction;
export const isDev = env.NODE_ENV === "development";
export const googleOAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Debug reset URLs are only ever emitted outside production. */
export const exposeResetUrlInLogs = env.AUTH_DEBUG_RESET_URL && !isProduction;

/** Origins permitted to send state-changing requests (CSRF origin allowlist). */
export const allowedOrigins: string[] = [
  env.NEXTAUTH_URL,
  ...(env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
].map((origin) => origin.replace(/\/$/, ""));
