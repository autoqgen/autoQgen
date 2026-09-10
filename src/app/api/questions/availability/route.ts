import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { objectIdSchema } from "@/lib/validation/common";
import { questionService } from "@/lib/services/question.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Organization-scoped approved-question availability for the paper builder's
 * live counts.
 *
 * Read-only. Returns the approved count for the category and, when `subject` is
 * given, the subject total plus a per-chapter breakdown — in one aggregation,
 * scoped to the caller's resolved organization exactly as the question list is.
 * `question:read` is checked inside the service (a plain member can gain it via
 * active organization membership), so it is not a static route permission.
 */
const availabilityQuerySchema = z.object({
  category: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: objectIdSchema.optional(),
});

type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const GET = defineRoute<undefined, undefined, AvailabilityQuery>({
  auth: true,
  rateLimit: "read",
  querySchema: availabilityQuerySchema,
  async handler({ query, user, requestId }) {
    const data = await questionService.availability(
      { category: query.category ?? null, subject: query.subject ?? null, organizationId: query.organizationId },
      user,
    );
    return ok(data, { requestId });
  },
});
