import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth.schema";
import { authService } from "@/lib/services/auth.service";
import { auditService } from "@/lib/services/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<RegisterInput>({
  auth: false,
  rateLimit: "register",
  bodySchema: registerSchema,
  async handler({ body, audit, requestId }) {
    const user = await authService.register(body);

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
