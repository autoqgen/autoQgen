import { NextResponse } from "next/server";
import type { ErrorCode, FieldIssue } from "@/lib/errors/app-error";

/**
 * One response envelope for every API route.
 *
 * The previous project returned six different shapes across its routes, which
 * forced clients into `body?.data ?? body` guesswork. Everything here is either
 * `{ success: true, data, meta? }` or `{ success: false, error }`.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldIssue[];
  };
  requestId: string;
}

export type ApiResponseBody<T> = ApiSuccess<T> | ApiFailure;

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function ok<T>(
  data: T,
  options: { status?: number; meta?: PaginationMeta; requestId: string; headers?: HeadersInit },
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    requestId: options.requestId,
  };
  if (options.meta) body.meta = options.meta;

  return NextResponse.json(body, {
    status: options.status ?? 200,
    headers: { "x-request-id": options.requestId, ...options.headers },
  });
}

export function fail(
  error: { code: ErrorCode; message: string; details?: FieldIssue[] },
  options: { status: number; requestId: string; headers?: HeadersInit },
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { success: false, error, requestId: options.requestId } satisfies ApiFailure,
    {
      status: options.status,
      headers: { "x-request-id": options.requestId, ...options.headers },
    },
  );
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
