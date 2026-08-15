import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth.schema";
import { passwordResetService } from "@/lib/services/password-reset.service";
import { auditService } from "@/lib/services/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<ResetPasswordInput>({
  auth: false,
  rateLimit: "resetPassword",
  bodySchema: resetPasswordSchema,
  async handler({ body, audit, requestId }) {
    await passwordResetService.resetPassword(body);

    await auditService.record(
      { action: "auth.password.reset", resourceType: "user" },
      audit,
    );
    return ok(
      { message: "Your password has been updated. You can now sign in." },
      { requestId },
    );
  },
});
