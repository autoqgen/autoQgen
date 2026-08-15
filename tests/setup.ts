/**
 * Vitest global setup.
 *
 * Provides a valid test environment so importing @/lib/config/env never throws
 * during unit tests. Integration tests override MONGODB_URI with an in-memory
 * server in their own setup.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/autoqgen-test";
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "test-secret-that-is-at-least-32-characters-long";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
