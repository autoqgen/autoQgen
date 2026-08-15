import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { questionService } from "@/lib/services/question.service";
import {
  bulkCreateQuestionSchema,
  type BulkCreateQuestionInput,
} from "@/lib/validation/question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 500 questions of realistic size fit comfortably inside 8 MiB. */
const MAX_BULK_BODY_BYTES = 8 * 1024 * 1024;

/**
 * Bulk import, capped at 500 items per request.
 *
 * The service performs a constant number of queries regardless of payload size
 * (six taxonomy lookups, one duplicate-hash lookup, one insertMany) rather than
 * the previous project's ~8 sequential round trips per item, and returns
 * per-item errors instead of reporting partial failure as success.
 *
 * Responds 207 when some rows failed so a client can distinguish a clean import
 * from a partial one without parsing the body.
 */
export const POST = defineRoute<BulkCreateQuestionInput>({
  auth: true,
  permission: "question:bulk-import",
  rateLimit: "questionBulkImport",
  bodySchema: bulkCreateQuestionSchema,
  maxBodyBytes: MAX_BULK_BODY_BYTES,
  async handler({ body, user, audit, requestId }) {
    const result = await questionService.bulkCreate(body.questions, user, audit);
    return ok(result, { status: result.failed > 0 ? 207 : 201, requestId });
  },
});
