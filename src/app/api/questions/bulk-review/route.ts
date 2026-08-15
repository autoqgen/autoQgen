import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { questionService } from "@/lib/services/question.service";
import {
  bulkReviewQuestionSchema,
  type BulkReviewQuestionInput,
} from "@/lib/validation/question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk approve/reject, for the review queue's select-all workflow.
 *
 * Permission and per-item transition validity are enforced inside the
 * service, same as the single-item PUT. Responds 207 when some ids were
 * skipped so a client can tell a clean batch from a partial one without
 * parsing the body.
 */
export const POST = defineRoute<BulkReviewQuestionInput>({
  auth: true,
  permission: "question:review",
  rateLimit: "questionBulkReview",
  bodySchema: bulkReviewQuestionSchema,
  async handler({ body, user, audit, requestId }) {
    const result = await questionService.bulkUpdateStatus(
      body.ids,
      body.status,
      body.reviewNote,
      user,
      audit,
    );
    return ok(result, { status: result.skipped.length > 0 ? 207 : 200, requestId });
  },
});
