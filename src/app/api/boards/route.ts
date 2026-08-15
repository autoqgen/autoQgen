import { taxonomyCollectionRoutes } from "@/lib/api/taxonomy-routes";
import { createBoardSchema } from "@/lib/validation/taxonomy.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = taxonomyCollectionRoutes({
  kind: "board",
  createSchema: createBoardSchema,
});
