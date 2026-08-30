import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { organizationService } from "@/lib/services/organization.service";
import { assignOwnerSchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute({
  auth: true,
  permission: "organization:manage",
  paramsSchema: routeIdParamsSchema,
  bodySchema: assignOwnerSchema,
  async handler({ params, body, user, audit, requestId }) {
    const updated = await organizationService.assignOwner(params.id, body, user, audit);
    return ok(updated, { requestId });
  },
});
