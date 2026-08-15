import { Category, Chapter, Question, Subject, Topic } from "@/models";
import type { AuthContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

/**
 * Real dashboard counts.
 *
 * The previous dashboard displayed hardcoded figures ("1,250", "+12%") styled to
 * look like live metrics. Everything here is an actual count, and each figure is
 * scoped to what the caller is allowed to see.
 */

export interface DashboardStats {
  approvedQuestions: number;
  pendingReview: number | null;
  myQuestions: number;
  myDrafts: number;
  subjects: number;
  chapters: number;
  topics: number;
  categories: number;
}

export async function getDashboardStats(actor: AuthContext): Promise<DashboardStats> {
  const isReviewer = can(actor.role, "question:review");

  const [
    approvedQuestions,
    pendingReview,
    myQuestions,
    myDrafts,
    categories,
    subjects,
    chapters,
    topics,
  ] = await Promise.all([
    Question.countDocuments({ isActive: true, status: "APPROVED" }).exec(),
    isReviewer
      ? Question.countDocuments({ isActive: true, status: "PENDING" }).exec()
      : Promise.resolve(null),
    Question.countDocuments({ isActive: true, createdBy: actor.objectId }).exec(),
    Question.countDocuments({
      isActive: true,
      createdBy: actor.objectId,
      status: "DRAFT",
    }).exec(),
    Category.countDocuments({ isActive: true }).exec(),
    Subject.countDocuments({ isActive: true }).exec(),
    Chapter.countDocuments({ isActive: true }).exec(),
    Topic.countDocuments({ isActive: true }).exec(),
  ]);

  return {
    approvedQuestions,
    pendingReview,
    myQuestions,
    myDrafts,
    categories,
    subjects,
    chapters,
    topics,
  };
}
