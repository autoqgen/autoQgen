import { taxonomyItemRoutes } from "@/lib/api/taxonomy-routes";
import { updateExamSchema } from "@/lib/validation/taxonomy.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, PUT, DELETE } = taxonomyItemRoutes({
  kind: "exam",
  updateSchema: updateExamSchema,
});
