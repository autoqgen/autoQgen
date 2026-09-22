import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth.schema";
import { authService } from "@/lib/services/auth.service";
import { auditService } from "@/lib/services/audit.service";
import { enforceRateLimit, releaseRateLimit } from "@/lib/rate-limit";
import { userRepository } from "@/lib/repositories/user.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<RegisterInput>({
  auth: false,
  rateLimit: "signupRequest",
  rateLimitMessage: "Too many signup attempts. Please try again later.",
  bodySchema: registerSchema,
  async handler({ body, audit, requestId }) {
    const accountExists = await userRepository.existsByEmail(body.email);
    if (!accountExists) {
      await enforceRateLimit(
        "signupSuccess",
        audit.ip ?? "unknown",
        "Too many accounts have been created from this IP address. Please try again later.",
      );
    }

    let user;
    try {
      user = await authService.register(body);
    } catch (error) {
      if (!accountExists) {
        await releaseRateLimit("signupSuccess", audit.ip ?? "unknown");
      }
      throw error;
    }

    await auditService.record(
      {
        action: "auth.register",
        resourceType: "user",
        resourceId: user.id,
        metadata: { role: user.role },
      },
      audit,
    );

    return ok(user, { status: 201, requestId });
  },
});
