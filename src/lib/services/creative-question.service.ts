import { Types } from "mongoose";

import type { AuthContext } from "@/lib/auth/session";
import { assertPermissionOrOrgMembership, requireContentOrganizationId, resolveContentOrganizationId } from "@/lib/auth/org-session";
import { ValidationError, NotFoundError } from "@/lib/errors/app-error";
import { CreativeQuestion, type ICreativeQuestion } from "@/models";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { loadHierarchyContext, validateHierarchyRefs } from "@/lib/services/question.service";
import type { AuditContext } from "@/lib/services/audit.service";
import { auditService } from "@/lib/services/audit.service";
import type { CreateCreativeQuestionInput, CreativeQuestionListQuery } from "@/lib/validation/creative-question.schema";

async function validatePlacement(input: CreateCreativeQuestionInput, organizationId: string) {
  const refs = { category: input.category, subject: input.subject, chapter: input.chapter, topic: input.topic ?? null, board: null, exam: null };
  const issues = validateHierarchyRefs(refs, await loadHierarchyContext([refs], organizationId));
  if (issues.length) throw new ValidationError("The selected taxonomy is invalid.", issues);
}

export const creativeQuestionService = {
  async create(input: CreateCreativeQuestionInput, actor: AuthContext, context?: AuditContext): Promise<ICreativeQuestion> {
    await assertPermissionOrOrgMembership(actor, "question:create", "question:create");
    if (input.status === "APPROVED") {
      await assertPermissionOrOrgMembership(actor, "question:review", "question:review");
    }
    const organizationId = await requireContentOrganizationId(actor, input.organizationId);
    await validatePlacement(input, organizationId);
    const { organizationId: _ignored, ...data } = input;
    const doc = await CreativeQuestion.create({
      ...data,
      organizationId: new Types.ObjectId(organizationId),
      totalMarks: 10,
      createdBy: actor.objectId,
    });
    if (context) await auditService.record({ action: "question.create", resourceType: "creative-question", resourceId: doc._id.toString(), metadata: { type: "CQ" } }, context);
    return doc.toObject();
  },

  async list(
    query: CreativeQuestionListQuery,
    actor: AuthContext,
  ): Promise<{ items: ICreativeQuestion[]; total: number }> {
    await assertPermissionOrOrgMembership(actor, "question:read", "question:read");
    const organizationId = await resolveContentOrganizationId(actor);
    if (!organizationId) return { items: [], total: 0 };
    const filter: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId), isActive: true };
    if (query.category) filter.category = new Types.ObjectId(query.category);
    if (query.subject) filter.subject = new Types.ObjectId(query.subject);
    if (query.chapter) filter.chapter = new Types.ObjectId(query.chapter);
    if (query.topic) filter.topic = new Types.ObjectId(query.topic);
    if (query.difficulty) filter.difficulty = query.difficulty;
    if (query.status) filter.status = query.status;
    if (query.mine) filter.createdBy = actor.objectId;
    if (query.search) filter.$or = [{ stimulus: { $regex: query.search, $options: "i" } }, { "questions.text": { $regex: query.search, $options: "i" } }];

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CreativeQuestion.find(filter)
        .populate("category", "name")
        .populate("subject", "name")
        .populate("chapter", "name")
        .populate("topic", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ICreativeQuestion[]>()
        .exec(),
      CreativeQuestion.countDocuments(filter).exec(),
    ]);

    const canSeeAnswers =
      Boolean(query.withAnswers) &&
      (await hasPermissionOrOrgMembership(actor, "question:read-answers", "question:read-answers"));

    if (!canSeeAnswers) {
      for (const item of items) {
        if (Array.isArray(item.questions)) {
          for (const q of item.questions) {
            q.answer = "";
          }
        }
      }
    }

    return { items, total };
  },

  async getById(id: string, actor: AuthContext, options?: { withAnswers?: boolean }): Promise<ICreativeQuestion> {
    await assertPermissionOrOrgMembership(actor, "question:read", "question:read");
    const organizationId = await resolveContentOrganizationId(actor);
    const doc = organizationId && Types.ObjectId.isValid(id)
      ? await CreativeQuestion.findOne({ _id: id, organizationId, isActive: true })
          .populate("category", "name")
          .populate("subject", "name")
          .populate("chapter", "name")
          .populate("topic", "name")
          .lean<ICreativeQuestion>()
          .exec()
      : null;
    if (!doc) throw new NotFoundError("Creative question");

    const canSeeAnswers =
      Boolean(options?.withAnswers) &&
      (await hasPermissionOrOrgMembership(actor, "question:read-answers", "question:read-answers"));

    if (!canSeeAnswers && Array.isArray(doc.questions)) {
      for (const q of doc.questions) {
        q.answer = "";
      }
    }

    return doc;
  },
};
