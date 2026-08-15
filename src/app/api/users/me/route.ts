import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { authService } from "@/lib/services/auth.service";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validation/auth.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  async handler({ user, requestId }) {
    return ok(await authService.getProfile(user), { requestId });
  },
});

export const PUT = defineRoute<UpdateProfileInput>({
  auth: true,
  bodySchema: updateProfileSchema,
  async handler({ body, user, requestId }) {
    return ok(await authService.updateProfile(user, body), { requestId });
  },
});
