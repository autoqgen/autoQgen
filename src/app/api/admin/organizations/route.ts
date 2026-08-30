import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { organizationService } from "@/lib/services/organization.service";
import { createOrganizationSchema, organizationListQuerySchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({
  auth: true,
  permission: "organization:manage",
  querySchema: organizationListQuerySchema,
  async handler({ query, requestId }) {
    const { items, total } = await organizationService.list(query);
    return ok(items, { requestId, meta: buildPaginationMeta(query.page, query.limit, total) });
  },
});

export const POST = defineRoute({
  auth: true,
  permission: "organization:manage",
  bodySchema: createOrganizationSchema,
  async handler({ body, user, audit, requestId }) {
    const created = await organizationService.create(body, user, audit);
    return ok(created, { status: 201, requestId });
  },
});
