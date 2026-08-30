import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { routeIdParamsSchema } from "@/lib/validation/common";
import { organizationService } from "@/lib/services/organization.service";
import { updateOrganizationSchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  permission: "organization:manage",
  paramsSchema: routeIdParamsSchema,
  async handler({ params, requestId }) {
    const org = await organizationService.getById(params.id);
    return ok(org, { requestId });
  },
});

export const PATCH = defineRoute({
  auth: true,
  permission: "organization:manage",
  paramsSchema: routeIdParamsSchema,
  bodySchema: updateOrganizationSchema,
  async handler({ params, body, audit, requestId }) {
    const updated = await organizationService.update(params.id, body, audit);
    return ok(updated, { requestId });
  },
});
