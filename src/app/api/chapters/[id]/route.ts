import { taxonomyItemRoutes } from "@/lib/api/taxonomy-routes";
import { updateChapterSchema } from "@/lib/validation/taxonomy.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, PUT, DELETE } = taxonomyItemRoutes({
  kind: "chapter",
  updateSchema: updateChapterSchema,
});
