import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { invitationService } from "@/lib/services/invitation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pending invitations addressed to the logged-in user's own email. */
export const GET = defineRoute({
  auth: true,
  async handler({ user, requestId }) {
    const items = await invitationService.listMine(user.email);
    return ok(items, { requestId });
  },
});
