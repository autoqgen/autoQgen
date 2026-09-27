import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { questionService } from "@/lib/services/question.service";
import {
  createCreativeGroupSchema,
  type CreateCreativeGroupInput,
} from "@/lib/validation/question.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute<CreateCreativeGroupInput>({
  auth: true,
  organizationPermission: {
    globalPermission: "question:create",
    organizationPermission: "question:create",
  },
  rateLimit: "questionCreate",
  bodySchema: createCreativeGroupSchema,
  async handler({ body, user, audit, requestId }) {
    return ok(await questionService.createCreativeGroup(body, user, audit), {
      status: 201,
      requestId,
    });
  },
});
