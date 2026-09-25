import type { ZodType } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { buildPaginationMeta, ok } from "@/lib/api/response";
import { routeIdParamsSchema, type RouteIdParams } from "@/lib/validation/common";
import {
  taxonomyListQuerySchema,
  type TaxonomyListQuery,
} from "@/lib/validation/taxonomy.schema";
import { taxonomyService } from "@/lib/services/taxonomy.service";
import type { TaxonomyKind } from "@/lib/repositories/taxonomy.repo";

/**
 * Route factory for the six taxonomy resources.
 *
 * The previous project shipped six route files that were ~85% identical and had
 * already diverged in capability. Collapsing them here means pagination, auth,
 * permissions, hierarchy validation and error shape are provably the same for
 * every resource — each concrete route file is now three lines of wiring.
 */

interface CollectionConfig<TCreate> {
  kind: TaxonomyKind;
  createSchema: ZodType<TCreate>;
}

export function taxonomyCollectionRoutes<TCreate extends Record<string, unknown>>(
  config: CollectionConfig<TCreate>,
) {
  const GET = defineRoute<undefined, undefined, TaxonomyListQuery>({
    auth: true,
    organizationPermission: {
      globalPermission: "taxonomy:read",
      organizationPermission: "taxonomy:read",
    },
    querySchema: taxonomyListQuerySchema,
    async handler({ query, user, requestId }) {
      const { items, total } = await taxonomyService.list(config.kind, query, user);
      return ok(items, {
        requestId,
        meta: buildPaginationMeta(query.page, query.limit, total),
      });
    },
  });

  const POST = defineRoute<TCreate>({
    auth: true,
    permission: "taxonomy:create",
    rateLimit: "taxonomyWrite",
    bodySchema: config.createSchema,
    async handler({ body, user, audit, requestId }) {
      const created = await taxonomyService.create(config.kind, user, body, audit);
      return ok(created, { status: 201, requestId });
    },
  });

  return { GET, POST };
}

interface ItemConfig<TUpdate> {
  kind: TaxonomyKind;
  updateSchema: ZodType<TUpdate>;
}

export function taxonomyItemRoutes<TUpdate extends Record<string, unknown>>(
  config: ItemConfig<TUpdate>,
) {
  const GET = defineRoute<undefined, RouteIdParams>({
    auth: true,
    organizationPermission: {
      globalPermission: "taxonomy:read",
      organizationPermission: "taxonomy:read",
    },
    paramsSchema: routeIdParamsSchema,
    async handler({ params, user, requestId }) {
      return ok(await taxonomyService.getById(config.kind, params.id, user), { requestId });
    },
  });

  const PUT = defineRoute<TUpdate, RouteIdParams>({
    auth: true,
    permission: "taxonomy:update",
    rateLimit: "taxonomyWrite",
    paramsSchema: routeIdParamsSchema,
    bodySchema: config.updateSchema,
    async handler({ body, params, user, audit, requestId }) {
      return ok(await taxonomyService.update(config.kind, user, params.id, body, audit), {
        requestId,
      });
    },
  });

  const DELETE = defineRoute<undefined, RouteIdParams>({
    auth: true,
    permission: "taxonomy:delete",
    rateLimit: "taxonomyWrite",
    paramsSchema: routeIdParamsSchema,
    async handler({ params, user, audit, requestId }) {
      await taxonomyService.deactivate(config.kind, user, params.id, audit);
      return ok({ id: params.id, deactivated: true }, { requestId });
    },
  });

  return { GET, PUT, DELETE };
}
