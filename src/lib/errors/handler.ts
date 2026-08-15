import { ZodError } from "zod";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { fail } from "@/lib/api/response";
import {
  AppError,
  ConflictError,
  RateLimitError,
  ValidationError,
  isAppError,
  type FieldIssue,
} from "@/lib/errors/app-error";

interface MongoServerErrorLike {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoServerErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as MongoServerErrorLike).code === 11000
  );
}

function isMongooseValidationError(error: unknown): error is Error & {
  name: string;
  errors: Record<string, { path?: string; message: string }>;
} {
  return (
    error instanceof Error &&
    error.name === "ValidationError" &&
    "errors" in error &&
    typeof (error as { errors?: unknown }).errors === "object"
  );
}

function isCastError(error: unknown): error is Error & { name: string; path?: string } {
  return error instanceof Error && error.name === "CastError";
}

export function zodIssuesToFieldIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/**
 * Normalises any thrown value into an AppError.
 *
 * Anything that is not already an AppError is treated as internal: it is logged
 * in full server-side and reduced to a generic message for the client.
 */
export function normaliseError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof ZodError) {
    return new ValidationError("The submitted data is invalid.", zodIssuesToFieldIssues(error));
  }

  if (isDuplicateKeyError(error)) {
    const fields = Object.keys(error.keyPattern ?? {});
    return new ConflictError(
      "A record with these values already exists.",
      fields.map((path) => ({ path, message: "Must be unique." })),
    );
  }

  if (isMongooseValidationError(error)) {
    return new ValidationError(
      "The submitted data is invalid.",
      Object.entries(error.errors).map(([path, detail]) => ({
        path,
        message: detail.message,
      })),
    );
  }

  if (isCastError(error)) {
    return new ValidationError("The submitted data is invalid.", [
      { path: error.path ?? "(root)", message: "Malformed identifier." },
    ]);
  }

  return new AppError("INTERNAL_ERROR", 500, "Something went wrong. Please try again.");
}

/**
 * Converts an error into an API response, logging safely along the way.
 */
export function toErrorResponse(error: unknown, requestId: string): NextResponse {
  const appError = normaliseError(error);

  if (appError.status >= 500) {
    logger.error("Unhandled server error", { requestId, error });
  } else {
    logger.info("Request rejected", {
      requestId,
      code: appError.code,
      status: appError.status,
    });
  }

  const headers: Record<string, string> = {};
  if (appError instanceof RateLimitError) {
    headers["Retry-After"] = String(appError.retryAfterSeconds);
  }

  return fail(
    {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
    { status: appError.status, requestId, headers },
  );
}
