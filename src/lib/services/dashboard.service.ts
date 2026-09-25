import { Category, Chapter, Question, Subject, Topic } from "@/models";
import type { AuthContext } from "@/lib/auth/session";
import { hasPermissionOrOrgMembership, resolveContentOrganizationId } from "@/lib/auth/org-session";

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
  const isReviewer = await hasPermissionOrOrgMembership(actor, "question:review", "question:review");
  const organizationId = await resolveContentOrganizationId(actor);

  if (!organizationId) {
    return {
      approvedQuestions: 0,
      pendingReview: isReviewer ? 0 : null,
      myQuestions: 0,
      myDrafts: 0,
      categories: 0,
      subjects: 0,
      chapters: 0,
      topics: 0,
    };
  }

  const organizationFilter = { organizationId };

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
    Question.countDocuments({ ...organizationFilter, isActive: true, status: "APPROVED" }).exec(),
    isReviewer
      ? Question.countDocuments({ ...organizationFilter, isActive: true, status: "PENDING" }).exec()
      : Promise.resolve(null),
    Question.countDocuments({
      ...organizationFilter,
      isActive: true,
      createdBy: actor.objectId,
    }).exec(),
    Question.countDocuments({
      ...organizationFilter,
      isActive: true,
      createdBy: actor.objectId,
      status: "DRAFT",
    }).exec(),
    Category.countDocuments({ ...organizationFilter, isActive: true }).exec(),
    Subject.countDocuments({ ...organizationFilter, isActive: true }).exec(),
    Chapter.countDocuments({ ...organizationFilter, isActive: true }).exec(),
    Topic.countDocuments({ ...organizationFilter, isActive: true }).exec(),
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
