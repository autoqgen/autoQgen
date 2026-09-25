import type { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";

import { newRequestId } from "@/lib/api/response";
import { toErrorResponse, zodIssuesToFieldIssues } from "@/lib/errors/handler";
import { PayloadTooLargeError, ValidationError } from "@/lib/errors/app-error";
import { requireAuth, getOptionalUser, assertPermission, type AuthContext } from "@/lib/auth/session";
import { assertPermissionOrOrgMembership } from "@/lib/auth/org-session";
import type { OrgPermission } from "@/lib/auth/org-rbac";
import { clientIdentifier, enforceRateLimit, type RateLimitName } from "@/lib/rate-limit";
import { assertTrustedOrigin, isStateChanging } from "@/lib/security/origin";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import type { Permission } from "@/lib/auth/rbac";
import { connectDB } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Route handler factory.
 *
 * Every API route is defined through this so that authentication, permission
 * checks, rate limiting, body-size limits, validation and error normalisation
 * happen in exactly one place. Handlers receive already-validated input and an
 * already-authorised actor, which keeps business logic out of transport code.
 */

/** 1 MiB for ordinary routes; bulk import raises it explicitly. */
const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export interface RouteContext<TBody, TParams, TQuery> {
  request: NextRequest;
  requestId: string;
  body: TBody;
  params: TParams;
  query: TQuery;
  user: AuthContext;
  /** Ready-made context for auditService.record — actor, requestId and ip. */
  audit: AuditContext;
}

export interface PublicRouteContext<TBody, TParams, TQuery>
  extends Omit<RouteContext<TBody, TParams, TQuery>, "user"> {
  user: AuthContext | null;
}

/** Re-exported so route files do not need a second import for audit calls. */
export type { AuditContext };
export { auditService };

interface BaseConfig<TBody, TParams, TQuery> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodySchema?: ZodType<TBody, any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paramsSchema?: ZodType<TParams, any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  querySchema?: ZodType<TQuery, any, any>;
  rateLimit?: RateLimitName;
  rateLimitMessage?: string;
  /** Overrides the request body size cap in bytes. */
  maxBodyBytes?: number;
  /** Skips the database connection (used by /api/health). */
  skipDb?: boolean;
  /**
   * Disables origin validation for this route.
   *
   * Only for endpoints that must accept non-browser cross-origin POSTs. No
   * route in this project sets it; it exists so a future webhook does not have
   * to weaken the shared check.
   */
  allowCrossOrigin?: boolean;
}

interface AuthedConfig<TBody, TParams, TQuery> extends BaseConfig<TBody, TParams, TQuery> {
  auth: true;
  permission?: Permission;
  organizationPermission?: {
    globalPermission: Permission;
    organizationPermission: OrgPermission;
  };
  handler: (ctx: RouteContext<TBody, TParams, TQuery>) => Promise<NextResponse>;
}

interface PublicConfig<TBody, TParams, TQuery> extends BaseConfig<TBody, TParams, TQuery> {
  auth: false;
  handler: (ctx: PublicRouteContext<TBody, TParams, TQuery>) => Promise<NextResponse>;
}

type RouteConfig<TBody, TParams, TQuery> =
  | AuthedConfig<TBody, TParams, TQuery>
  | PublicConfig<TBody, TParams, TQuery>;

/** Next.js passes route params as a promise in the App Router. */
export interface RouteSegment {
  params: Promise<Record<string, string | string[] | undefined>>;
}

type NextRouteHandler = (
  request: NextRequest,
  segment: RouteSegment,
) => Promise<NextResponse>;

async function readJsonBody(request: NextRequest, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ValidationError("Request body must be JSON (Content-Type: application/json).");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLargeError(
      `Request body must not exceed ${Math.floor(maxBytes / 1024)} KiB.`,
    );
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new PayloadTooLargeError(
      `Request body must not exceed ${Math.floor(maxBytes / 1024)} KiB.`,
    );
  }

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body is not valid JSON.");
  }
}

function parseWith<T>(schema: ZodType<T> | undefined, value: unknown, label: string): T {
  if (!schema) return undefined as T;

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid ${label}.`, zodIssuesToFieldIssues(result.error));
  }
  return result.data;
}

export function defineRoute<TBody = undefined, TParams = undefined, TQuery = undefined>(
  config: RouteConfig<TBody, TParams, TQuery>,
): NextRouteHandler {
  return async function handle(request, segment) {
    const requestId = request.headers.get("x-request-id") ?? newRequestId();
    const started = Date.now();

    const ip = clientIdentifier(request);

    try {
      /**
       * Origin validation runs before anything else, so a cross-site request
       * cannot consume rate-limit budget or reach the database.
       */
      if (!config.allowCrossOrigin && isStateChanging(request.method)) {
        try {
          assertTrustedOrigin(request);
        } catch (originError) {
          logger.warn("Blocked cross-origin request", {
            requestId,
            method: request.method,
            path: new URL(request.url).pathname,
          });
          throw originError;
        }
      }

      if (config.rateLimit) {
        await enforceRateLimit(config.rateLimit, ip, config.rateLimitMessage);
      }

      if (!config.skipDb) {
        await connectDB();
      }

      const rawParams = segment?.params ? await segment.params : {};
      const params = parseWith(config.paramsSchema, rawParams, "route parameters");

      const url = new URL(request.url);
      const query = parseWith(
        config.querySchema,
        Object.fromEntries(url.searchParams.entries()),
        "query parameters",
      );

      const method = request.method.toUpperCase();
      const expectsBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
      const rawBody = config.bodySchema && expectsBody
        ? await readJsonBody(request, config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)
        : {};
      const body = parseWith(config.bodySchema, rawBody, "request body");

      if (config.auth) {
        const user = await requireAuth();
        if (config.organizationPermission) {
          await assertPermissionOrOrgMembership(
            user,
            config.organizationPermission.globalPermission,
            config.organizationPermission.organizationPermission,
          );
        } else if (config.permission) {
          assertPermission(user, config.permission);
        }
        return await config.handler({
          request,
          requestId,
          body,
          params,
          query,
          user,
          audit: { actor: user, requestId, ip },
        });
      }

      const user = await getOptionalUser();
      return await config.handler({
        request,
        requestId,
        body,
        params,
        query,
        user,
        audit: { actor: user, requestId, ip },
      });
    } catch (error) {
      return toErrorResponse(error, requestId);
    } finally {
      logger.debug("Request handled", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        durationMs: Date.now() - started,
      });
    }
  };
}
