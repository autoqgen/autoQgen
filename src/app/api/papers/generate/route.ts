import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import {
  assertPermissionOrOrgMembership,
  requireContentOrganizationId,
} from "@/lib/auth/org-session";
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
 *
 * paper:create is checked here directly (not via a static route permission)
 * because this handler calls paperGeneratorService, not paperService — the
 * same assertPermissionOrOrgMembership fallback used by
 * paperService.create()/generateAndSave() applies here too, so a member with
 * an active organization membership can preview, not just save.
 */
export const PUT = defineRoute<GeneratePaperInput>({
  auth: true,
  rateLimit: "paperGenerate",
  bodySchema: generatePaperSchema,
  async handler({ body, user, requestId }) {
    await assertPermissionOrOrgMembership(user, "paper:create", "paper:create");
    const organizationId = await requireContentOrganizationId(user, body.organizationId);
    return ok(await paperGeneratorService.generate(body, organizationId), { requestId });
  },
});

/** Generate and persist in one step. paper:create is checked inside paperService.generateAndSave() — see /api/papers's create route. */
export const POST = defineRoute<GenerateAndSavePaperInput>({
  auth: true,
  rateLimit: "paperGenerate",
  bodySchema: generateAndSavePaperSchema,
  async handler({ body, user, audit, requestId }) {
    const { paper, warnings } = await paperService.generateAndSave(body, user, audit);
    return ok({ paper, warnings }, { status: 201, requestId });
  },
});
