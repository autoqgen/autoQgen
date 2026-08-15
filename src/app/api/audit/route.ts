import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { paginationQuerySchema } from "@/lib/validation/common";
import { auditService } from "@/lib/services/audit.service";
import { AUDIT_ACTIONS } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditQuerySchema = paginationQuerySchema.extend({
  action: z.enum(AUDIT_ACTIONS).optional(),
  resourceType: z.enum(["question", "paper", "taxonomy", "user", "auth", "security"]).optional(),
});

type AuditQuery = z.infer<typeof auditQuerySchema>;

/** Read-only. There is deliberately no endpoint that writes or deletes entries. */
export const GET = defineRoute<undefined, undefined, AuditQuery>({
  auth: true,
  permission: "audit:read",
  querySchema: auditQuerySchema,
  async handler({ query, user, requestId }) {
    const { items, total } = await auditService.list(user, query);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});
