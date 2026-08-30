import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { invitationService } from "@/lib/services/invitation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute({
  auth: true,
  paramsSchema: routeIdParamsSchema,
  async handler({ params, user, audit, requestId }) {
    const result = await invitationService.accept(params.id, user, audit);
    return ok(result, { requestId });
  },
});
