import type { Metadata } from "next";

import ReviewQueue from "@/components/review/ReviewQueue";
import { requireAuth } from "@/lib/auth/session";
import { hasPermissionOrOrgMembership, resolveContentOrganizationId } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "Review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireAuth();

  // The queue is strictly scoped to the caller's current organization (for a
  // super_admin, the one selected in their context). With none resolved there
  // is nothing to review — the component shows a "select an organization"
  // state rather than firing a request that would come back empty.
  const organizationId = await resolveContentOrganizationId(user);

  return (
    <ReviewQueue
      canReview={await hasPermissionOrOrgMembership(user, "question:review", "question:review")}
      hasOrganization={Boolean(organizationId)}
    />
  );
}
