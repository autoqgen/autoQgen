import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { paperGeneratorService } from "@/lib/services/paper-generator.service";
import { paperService } from "@/lib/services/paper.service";
import {
  generateAndSavePaperSchema,
  generatePaperSchema,
  type GenerateAndSavePaperInput,
  type GeneratePaperInput,
} from "@/lib/validation/paper.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dry-run generation.
 *
 * Returns the selected question ids, the bucket plan and any shortfall warnings
 * without persisting anything, so the builder UI can show a teacher exactly what
 * they will get before committing.
 */
export const PUT = defineRoute<GeneratePaperInput>({
  auth: true,
  permission: "paper:create",
  rateLimit: "paperGenerate",
  bodySchema: generatePaperSchema,
  async handler({ body, requestId }) {
    return ok(await paperGeneratorService.generate(body), { requestId });
  },
});

/** Generate and persist in one step. */
export const POST = defineRoute<GenerateAndSavePaperInput>({
  auth: true,
  permission: "paper:create",
  rateLimit: "paperGenerate",
  bodySchema: generateAndSavePaperSchema,
  async handler({ body, user, audit, requestId }) {
    const { paper, warnings } = await paperService.generateAndSave(body, user, audit);
    return ok({ paper, warnings }, { status: 201, requestId });
  },
});
