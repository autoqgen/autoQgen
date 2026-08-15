import type { PaginationMeta } from "@/lib/api/response";
import type { ErrorCode, FieldIssue } from "@/lib/errors/app-error";

/** Client-side mirror of the API envelope produced by @/lib/api/response. */
export type ApiResult<T> =
  | { success: true; data: T; meta?: PaginationMeta; requestId: string }
  | {
      success: false;
      error: { code: ErrorCode; message: string; details?: FieldIssue[] };
      requestId: string;
    };

export type { PaginationMeta, ErrorCode, FieldIssue };
