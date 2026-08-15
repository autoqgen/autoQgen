import { env } from "@/lib/config/env";

/**
 * Minimal structured logger.
 *
 * Deliberately dependency-free and deliberately redacting: the previous project
 * logged request bodies, bearer tokens and the JWT signing secret. Any key that
 * looks sensitive is replaced with "[redacted]" before serialisation, and values
 * are depth- and length-capped so a full database result can never be dumped
 * into the log stream.
 */

export type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 10,
  warn: 20,
  info: 30,
  debug: 40,
};

const SENSITIVE_KEY = new RegExp(
  [
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "cookie",
    "session",
    "apikey",
    "api_key",
    "credential",
    "mongodb_uri",
    "connectionstring",
    "answer",
    "correctoptions",
    "booleananswer",
  ].join("|"),
  "i",
);

const MAX_STRING = 512;
const MAX_ARRAY = 20;
const MAX_DEPTH = 4;

export type LogContext = Record<string, unknown>;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return "[truncated]";

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) {
    const items: unknown[] = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`…and ${value.length - MAX_ARRAY} more`);
    return items;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(inner, depth + 1);
    }
    return out;
  }

  return "[unserialisable]";
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[env.LOG_LEVEL]) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? (redact(context) as LogContext) : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }
}

export const logger = {
  error: (message: string, context?: LogContext) => emit("error", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
};

export type Logger = typeof logger;
