import type { Metadata } from "next";

import ReviewQueue from "@/components/review/ReviewQueue";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireAuth();
  return <ReviewQueue canReview={can(user.role, "question:review")} />;
}
