/**
 * Application error taxonomy.
 *
 * Every error that reaches the API boundary is mapped to one of these. Only
 * `message` and `details` of an AppError are ever sent to a client; anything
 * else becomes a generic 500 plus a correlation id, so internal Mongoose
 * messages (schema paths, index names, collection names) never leak.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

export interface FieldIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: FieldIssue[];
  /** Safe to expose to the client. Non-AppErrors are never exposed. */
  readonly expose = true;

  constructor(code: ErrorCode, status: number, message: string, details?: FieldIssue[]) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted data is invalid.", details?: FieldIssue[]) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("NOT_FOUND", 404, `${resource} not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message = "That resource already exists.", details?: FieldIssue[]) {
    super("CONFLICT", 409, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "The request payload is too large.") {
    super("PAYLOAD_TOO_LARGE", 413, message);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many requests. Please try again later.") {
    super("RATE_LIMITED", 429, message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
