import { taxonomyCollectionRoutes } from "@/lib/api/taxonomy-routes";
import { createCategorySchema } from "@/lib/validation/taxonomy.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = taxonomyCollectionRoutes({
  kind: "category",
  createSchema: createCategorySchema,
});
