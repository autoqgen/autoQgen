import mongoose, { type Mongoose } from "mongoose";

import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";

/**
 * Serverless-safe Mongoose connection.
 *
 * Cached on globalThis so hot reloads and warm lambda invocations reuse a single
 * pool. On failure the cached promise is cleared so the next request retries,
 * but retries are gated by a short backoff window so a database outage does not
 * turn into a connection storm.
 *
 * There is deliberately no filesystem persistence anywhere in this project.
 */

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
  lastFailureAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __autoqgenMongoose: MongooseCache | undefined;
}

const RETRY_BACKOFF_MS = 2_000;

const cache: MongooseCache =
  globalThis.__autoqgenMongoose ??
  (globalThis.__autoqgenMongoose = { conn: null, promise: null, lastFailureAt: 0 });

export async function connectDB(): Promise<Mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    const sinceFailure = Date.now() - cache.lastFailureAt;
    if (cache.lastFailureAt > 0 && sinceFailure < RETRY_BACKOFF_MS) {
      throw new Error("Database is unavailable. Retrying shortly.");
    }

    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        serverSelectionTimeoutMS: 8_000,
        socketTimeoutMS: 45_000,
        maxPoolSize: 10,
        minPoolSize: 0,
        retryWrites: true,
        // Fail fast instead of silently queueing operations when disconnected.
        bufferCommands: false,
        autoIndex: env.NODE_ENV !== "production",
      })
      .then((instance) => {
        cache.lastFailureAt = 0;
        // Never log the URI — it contains credentials.
        logger.info("MongoDB connected", { readyState: instance.connection.readyState });
        return instance;
      })
      .catch((error: unknown) => {
        cache.promise = null;
        cache.lastFailureAt = Date.now();
        logger.error("MongoDB connection failed", { error });
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDB(): Promise<void> {
  if (cache.conn) {
    await mongoose.disconnect();
  }
  cache.conn = null;
  cache.promise = null;
  cache.lastFailureAt = 0;
}

export function connectionState(): number {
  return mongoose.connection.readyState;
}
