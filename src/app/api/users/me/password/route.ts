import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { authService } from "@/lib/services/auth.service";
import { auditService } from "@/lib/services/audit.service";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/auth.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Changing a password revokes every session issued before the change, so the
 * client must sign in again. The previous project's settings screen had a
 * "Save Password" button whose handler did nothing at all.
 */
export const PUT = defineRoute<ChangePasswordInput>({
  auth: true,
  rateLimit: "changePassword",
  bodySchema: changePasswordSchema,
  async handler({ body, user, audit, requestId }) {
    await authService.changePassword(user, body);

    await auditService.record(
      { action: "auth.password.change", resourceType: "user", resourceId: user.id },
      audit,
    );
    return ok(
      { message: "Password updated. Please sign in again.", reauthenticationRequired: true },
      { requestId },
    );
  },
});
