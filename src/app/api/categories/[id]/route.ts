import { taxonomyItemRoutes } from "@/lib/api/taxonomy-routes";
import { updateCategorySchema } from "@/lib/validation/taxonomy.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, PUT, DELETE } = taxonomyItemRoutes({
  kind: "category",
  updateSchema: updateCategorySchema,
});
