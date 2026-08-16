import { Types } from "mongoose";
type FilterQuery<T> = Record<string, any>;

import { AuditLog, type IAuditLog } from "@/models";

/**
 * Audit log data access.
 *
 * Write-and-read only: there is deliberately no update or delete method, so the
 * trail cannot be rewritten through the application. Expiry is handled by the
 * TTL index on the model.
 */

export const auditRepository = {
  async record(entry: Record<string, unknown>): Promise<void> {
    await AuditLog.create(entry);
  },

  async list(options: {
    filter: FilterQuery<IAuditLog>;
    skip: number;
    limit: number;
  }): Promise<{ items: IAuditLog[]; total: number }> {
    const [items, total] = await Promise.all([
      AuditLog.find(options.filter)
        .populate("actor", "name email")
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .lean<IAuditLog[]>()
        .exec(),
      AuditLog.countDocuments(options.filter).exec(),
    ]);

    return { items, total };
  },

  async listForResource(
    resourceType: string,
    resourceId: string,
    limit: number,
  ): Promise<IAuditLog[]> {
    return AuditLog.find({ resourceType, resourceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<IAuditLog[]>()
      .exec();
  },

  async countForActor(actorId: Types.ObjectId, since: Date): Promise<number> {
    return AuditLog.countDocuments({ actor: actorId, createdAt: { $gte: since } }).exec();
  },
};

export type AuditRepository = typeof auditRepository;
