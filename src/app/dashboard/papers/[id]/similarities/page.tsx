import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SimilarityReview from "@/components/papers/SimilarityReview";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { paperService } from "@/lib/services/paper.service";
import {
  paperSimilarityService,
  type SimilarityReviewResult,
} from "@/lib/services/paper-similarity.service";

export const metadata: Metadata = { title: "Similarity Review" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PaperSimilaritiesPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const paper = await paperService.getById(id, user).catch(() => null);
  if (!paper) notFound();

  let review: SimilarityReviewResult | null = null;
  let error: string | null = null;
  try {
    review = await paperSimilarityService.getReview(id, user);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not run the similarity check.";
  }

  const isOwner = paper.createdBy?.toString() === user.id;
  const canResolve =
    (isOwner || can(user.role, "paper:update:any")) && paper.status !== "ARCHIVED";

  return (
    <SimilarityReview
      paperId={id}
      paperTitle={paper.title}
      review={review}
      error={error}
      canResolve={canResolve}
    />
  );
}
