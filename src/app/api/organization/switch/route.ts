import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { organizationMemberService } from "@/lib/services/organization-member.service";
import { switchOrganizationSchema } from "@/lib/validation/organization.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute({
  auth: true,
  bodySchema: switchOrganizationSchema,
  async handler({ body, user, requestId }) {
    const result = await organizationMemberService.switchCurrentOrganization(user, body.organizationId);
    return ok(result, { requestId });
  },
});
