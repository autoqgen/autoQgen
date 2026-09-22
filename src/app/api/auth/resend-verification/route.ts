import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import {
  resendVerificationSchema,
  type ResendVerificationInput,
} from "@/lib/validation/auth.schema";
import { emailVerificationService } from "@/lib/services/email-verification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<ResendVerificationInput>({
  auth: false,
  rateLimit: "resendVerification",
  bodySchema: resendVerificationSchema,
  async handler({ body, requestId }) {
    await emailVerificationService.resend(body.email);
    return ok(
      { message: "If an unverified account exists, a verification email has been sent." },
      { requestId },
    );
  },
});