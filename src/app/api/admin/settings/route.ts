import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { settingRepository } from "@/lib/repositories/setting.repo";
import { auditService } from "@/lib/services/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSettingsSchema = z.object({
  siteName: z.string().min(2, "Site name must be at least 2 characters"),
  defaultLanguage: z.string().min(1),
  maxQuestionsPerPaper: z.string().min(1),
  defaultPaperQuestions: z.string().min(1),
  allowSelfRegistration: z.string().min(1),
  maintenanceMode: z.string().min(1),
});

export const GET = defineRoute({
  auth: true,
  permission: "user:manage-roles",
  async handler({ requestId }) {
    const settings = await settingRepository.get();
    return ok(settings, { requestId });
  },
});

export const PUT = defineRoute({
  auth: true,
  permission: "user:manage-roles",
  bodySchema: updateSettingsSchema,
  async handler({ body, user, audit, requestId }) {
    const updated = await settingRepository.update(body);

    await auditService.record(
      {
        action: "user.update-role",
        resourceType: "settings",
        resourceId: "global",
        metadata: { settings: updated, updatedBy: user.id },
      },
      audit
    );

    return ok(updated, { requestId });
  },
});

export const POST = PUT;
