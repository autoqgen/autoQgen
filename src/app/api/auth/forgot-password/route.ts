import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { clientIdentifier } from "@/lib/rate-limit";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth.schema";
import { passwordResetService } from "@/lib/services/password-reset.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Always answers with the same body and the same 200 status, whether or not the
 * email belongs to an account. The previous project issued a token and sent mail
 * to any address supplied, and returned a distinguishable 500 on delivery
 * failure — an email-bombing relay and an enumeration oracle in one route.
 */
export const POST = defineRoute<ForgotPasswordInput>({
  auth: false,
  rateLimit: "forgotPassword",
  bodySchema: forgotPasswordSchema,
  async handler({ body, request, requestId }) {
    const result = await passwordResetService.requestReset(body, {
      ip: clientIdentifier(request),
    });
    return ok(result, { requestId });
  },
});
