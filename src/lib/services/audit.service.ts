import { Types } from "mongoose";

import { auditRepository } from "@/lib/repositories/audit.repo";
import { logger } from "@/lib/logger";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import { toSkip } from "@/lib/validation/common";
import type { AuditAction, IAuditLog } from "@/models";

/**
 * Audit logging.
 *
 * Recording is best-effort by design: an audit write must never fail the
 * operation it describes. Failures are logged and swallowed. Reading is
 * permission-gated behind `audit:read`.
 *
 * Metadata is caller-supplied but passes through the same redacting logger
 * rules conceptually — services only ever pass small, non-sensitive summaries
 * (ids, counts, status transitions). Never answers, passwords or tokens.
 */

export interface AuditContext {
  actor: AuthContext | null;
  requestId?: string;
  ip?: string;
}

export interface AuditEntry {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  outcome?: "success" | "failure";
}

export const auditService = {
  async record(entry: AuditEntry, context: AuditContext): Promise<void> {
    try {
      await auditRepository.record({
        action: entry.action,
        actor: context.actor?.objectId ?? null,
        actorRole: context.actor?.role ?? "anonymous",
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? "",
        metadata: entry.metadata ?? {},
        requestId: context.requestId ?? "",
        ip: context.ip ?? "",
        outcome: entry.outcome ?? "success",
      });
    } catch (error: unknown) {
      // Never let auditing break the request it is describing.
      logger.error("Audit write failed", { action: entry.action, error });
    }
  },

  async list(
    actor: AuthContext,
    query: { page: number; limit: number; action?: string; resourceType?: string },
  ): Promise<{ items: IAuditLog[]; total: number }> {
    assertPermission(actor, "audit:read");

    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.resourceType) filter.resourceType = query.resourceType;

    return auditRepository.list({
      filter,
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
    });
  },

  async listForResource(
    actor: AuthContext,
    resourceType: string,
    resourceId: string,
  ): Promise<IAuditLog[]> {
    assertPermission(actor, "audit:read");
    if (!Types.ObjectId.isValid(resourceId)) return [];
    return auditRepository.listForResource(resourceType, resourceId, 50);
  },
};

export type AuditService = typeof auditService;
