import { Types, type QueryFilter as FilterQuery } from "mongoose";

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

    // Batch resolve target user email & name for user audit logs
    const userResourceIds = items
      .filter(
        (item) =>
          item.resourceType === "user" &&
          item.resourceId &&
          Types.ObjectId.isValid(item.resourceId)
      )
      .map((item) => item.resourceId);

    if (userResourceIds.length > 0) {
      const { User } = await import("@/models");
      const targetUsers = await User.find({ _id: { $in: userResourceIds } })
        .select("_id email name")
        .lean()
        .exec();
      const userMap = new Map(targetUsers.map((u) => [u._id.toString(), u]));

      for (const item of items) {
        if (item.resourceType === "user" && item.resourceId) {
          const target = userMap.get(item.resourceId);
          if (target) {
            item.metadata = {
              ...(item.metadata || {}),
              targetEmail: target.email,
              targetName: target.name,
            };
          }
        }
      }
    }

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
