import { Types, type QueryFilter as FilterQuery, type SortOrder } from "mongoose";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type FieldIssue,
} from "@/lib/errors/app-error";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import { can, canActOnResource } from "@/lib/auth/rbac";
import { paperRepository, type PaperDoc } from "@/lib/repositories/paper.repo";
import { questionRepository } from "@/lib/repositories/question.repo";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { paperGeneratorService } from "@/lib/services/paper-generator.service";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { toSkip } from "@/lib/validation/common";
import { escapeRegExp } from "@/lib/security/regex";
import { logger } from "@/lib/logger";
import { canTransitionPaper, type PaperStatus } from "@/types/paper";
import { MAX_QUESTIONS_PER_PAPER } from "@/lib/validation/paper.schema";
import type { IQuestionPaper } from "@/models";
import type {
  CreatePaperInput,
  GenerateAndSavePaperInput,
  PaperListQuery,
  UpdatePaperInput,
} from "@/lib/validation/paper.schema";

/**
 * Question paper business rules.
 *
 * Reuses the Step 1 patterns throughout: permissions via assertPermission and
 * canActOnResource, hierarchy checks via taxonomyRepository, ownership enforced
 * here rather than in the route, and audit entries on every mutation.
 */

interface NormalisedSection {
  title: string;
  instructions: string;
  order: number;
  questions: { question: Types.ObjectId; order: number; marks: number; note: string }[];
}

/** Recomputed on every write. Clients never supply totals. */
function computeTotals(sections: NormalisedSection[]): {
  totalMarks: number;
  totalQuestions: number;
} {
  let totalMarks = 0;
  let totalQuestions = 0;

  for (const section of sections) {
    for (const entry of section.questions) {
      totalMarks += entry.marks;
      totalQuestions += 1;
    }
  }

  return { totalMarks, totalQuestions };
}

/**
 * Validates every referenced question and snapshots its marks.
 *
 * Rules enforced:
 *  - the question exists and is active
 *  - it is APPROVED (a paper never contains unreviewed content)
 *  - it belongs to the paper's subject
 *  - no question appears twice anywhere in the paper
 */
async function resolveSections(
  input: { sections: CreatePaperInput["sections"]; subject: string },
): Promise<NormalisedSection[]> {
  const sections = input.sections ?? [];
  const issues: FieldIssue[] = [];

  const allIds: string[] = [];
  const seen = new Set<string>();

  sections.forEach((section, sectionIndex) => {
    section.questions.forEach((entry, questionIndex) => {
      if (seen.has(entry.question)) {
        issues.push({
          path: `sections.${sectionIndex}.questions.${questionIndex}.question`,
          message: "This question already appears in the paper.",
        });
        return;
      }
      seen.add(entry.question);
      allIds.push(entry.question);
    });
  });

  if (allIds.length > MAX_QUESTIONS_PER_PAPER) {
    issues.push({
      path: "sections",
      message: `A paper may contain at most ${MAX_QUESTIONS_PER_PAPER} questions.`,
    });
  }

  if (issues.length > 0) {
    throw new ValidationError("The paper contains invalid question selections.", issues);
  }

  // One batched lookup for the whole paper, not one per question.
  const docs = await questionRepository.findForPaper(allIds);
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));

  const normalised: NormalisedSection[] = sections.map((section, sectionIndex) => ({
    title: section.title ?? "",
    instructions: section.instructions ?? "",
    order: section.order ?? sectionIndex,
    questions: section.questions.map((entry, questionIndex) => {
      const doc = byId.get(entry.question);
      const path = `sections.${sectionIndex}.questions.${questionIndex}.question`;

      if (!doc || !doc.isActive) {
        issues.push({ path, message: "This question no longer exists." });
        return { question: new Types.ObjectId(entry.question), order: questionIndex, marks: 0, note: "" };
      }
      if (doc.status !== "APPROVED") {
        issues.push({ path, message: "Only approved questions can be added to a paper." });
      }
      if (doc.subject?.toString() !== input.subject) {
        issues.push({ path, message: "This question belongs to a different subject." });
      }

      return {
        question: doc._id,
        order: entry.order ?? questionIndex,
        // Snapshot: an override wins, otherwise the question's own marks.
        marks: entry.marks ?? doc.marks ?? 1,
        note: entry.note ?? "",
      };
    }),
  }));

  if (issues.length > 0) {
    throw new ValidationError("The paper contains invalid question selections.", issues);
  }

  // Normalise ordering so the stored document is always canonical.
  normalised.sort((a, b) => a.order - b.order);
  normalised.forEach((section, index) => {
    section.order = index;
    section.questions.sort((a, b) => a.order - b.order);
    section.questions.forEach((entry, entryIndex) => {
      entry.order = entryIndex;
    });
  });

  return normalised;
}

async function assertTaxonomy(input: { category: string; subject: string }): Promise<void> {
  const subject = await taxonomyRepository.findById("subject", input.subject);

  if (!subject) {
    throw new ValidationError("The selected taxonomy is invalid.", [
      { path: "subject", message: "The selected subject does not exist." },
    ]);
  }

  if (subject.category?.toString() !== input.category) {
    throw new ValidationError("The selected taxonomy is invalid.", [
      { path: "subject", message: "The selected subject does not belong to the selected category." },
    ]);
  }
}

function buildListFilter(query: PaperListQuery, actor: AuthContext): FilterQuery<IQuestionPaper> {
  const filter: FilterQuery<IQuestionPaper> = { isActive: true };

  if (query.status) filter.status = query.status;
  if (query.category) filter.category = new Types.ObjectId(query.category);
  if (query.subject) filter.subject = new Types.ObjectId(query.subject);
  if (query.board) filter.board = new Types.ObjectId(query.board);
  if (query.exam) filter.exam = new Types.ObjectId(query.exam);

  /**
   * Visibility: anyone who can edit any paper sees everything. Everyone else
   * sees their own papers plus published ones.
   */
  const seesAll = can(actor.role, "paper:update:any");

  if (query.mine) {
    filter.createdBy = actor.objectId;
  } else if (!seesAll) {
    filter.$or = [{ createdBy: actor.objectId }, { status: "PUBLISHED" }];
  }

  if (query.search) {
    filter.title = { $regex: `^${escapeRegExp(query.search)}`, $options: "i" };
  }

  return filter;
}

function buildSort(query: PaperListQuery): Record<string, SortOrder> {
  if (query.sort === "title") return { title: 1 };
  if (query.sort === "oldest") return { updatedAt: 1 };
  return { updatedAt: -1 };
}

function assertCanView(paper: PaperDoc, actor: AuthContext): void {
  const isOwner = paper.createdBy?.toString() === actor.id;
  const seesAll = can(actor.role, "paper:update:any");

  if (!isOwner && !seesAll && paper.status !== "PUBLISHED") {
    // Same shape as a genuine miss, so existence is not disclosed.
    throw new NotFoundError("Paper");
  }
}

function versionEntry(
  actor: AuthContext,
  version: number,
  summary: string,
  totals: { totalMarks: number; totalQuestions: number },
): Record<string, unknown> {
  return {
    version,
    changedBy: actor.objectId,
    changedAt: new Date(),
    summary,
    questionCount: totals.totalQuestions,
    totalMarks: totals.totalMarks,
  };
}

export const paperService = {
  async list(
    query: PaperListQuery,
    actor: AuthContext,
  ): Promise<{ items: PaperDoc[]; total: number }> {
    assertPermission(actor, "paper:read");

    return paperRepository.list({
      filter: buildListFilter(query, actor),
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
      sort: buildSort(query),
    });
  },

  async getById(
    id: string,
    actor: AuthContext,
    options?: { withAnswers?: boolean },
  ): Promise<PaperDoc> {
    assertPermission(actor, "paper:read");

    // Answers are only ever loaded for a caller holding the export permission.
    const withAnswers = Boolean(options?.withAnswers) && can(actor.role, "paper:export-answers");

    const paper = await paperRepository.findById(id, {
      populateQuestions: true,
      withAnswers,
    });

    if (!paper || !paper.isActive) throw new NotFoundError("Paper");
    assertCanView(paper, actor);

    return paper;
  },

  async create(input: CreatePaperInput, actor: AuthContext, context: AuditContext): Promise<PaperDoc> {
    assertPermission(actor, "paper:create");
    await assertTaxonomy(input);

    const sections = await resolveSections({ sections: input.sections, subject: input.subject });
    const totals = computeTotals(sections);

    const paper = await paperRepository.create({
      ...input,
      sections,
      ...totals,
      mode: "MANUAL",
      status: "DRAFT",
      version: 1,
      versionHistory: [versionEntry(actor, 1, "Created", totals)],
      createdBy: actor.objectId,
    });

    await auditService.record(
      {
        action: "paper.create",
        resourceType: "paper",
        resourceId: paper._id.toString(),
        metadata: { title: paper.title, questions: totals.totalQuestions },
      },
      context,
    );

    return paper;
  },

  async generateAndSave(
    input: GenerateAndSavePaperInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<{ paper: PaperDoc; warnings: unknown[] }> {
    assertPermission(actor, "paper:create");
    await assertTaxonomy({ category: input.spec.category, subject: input.spec.subject });

    const generated = await paperGeneratorService.generate(input.spec);

    const sections: NormalisedSection[] = [
      {
        title: "",
        instructions: "",
        order: 0,
        questions: generated.questions.map((question, index) => ({
          question: new Types.ObjectId(question.id),
          order: index,
          marks: question.marks,
          note: "",
        })),
      },
    ];

    const totals = computeTotals(sections);

    const paper = await paperRepository.create({
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      category: input.spec.category,
      subject: input.spec.subject,
      board: input.spec.board,
      exam: input.spec.exam,
      year: input.spec.year,
      durationMinutes: input.durationMinutes,
      sections,
      ...totals,
      mode: "AUTO",
      status: "DRAFT",
      generationSpec: {
        chapters: input.spec.chapters,
        topics: input.spec.topics,
        totalQuestions: input.spec.totalQuestions,
        totalMarks: input.spec.totalMarks,
        difficultyDistribution: input.spec.difficultyDistribution,
        typeDistribution: input.spec.typeDistribution,
        language: input.spec.language,
        seed: generated.seed,
      },
      version: 1,
      versionHistory: [versionEntry(actor, 1, "Generated automatically", totals)],
      createdBy: actor.objectId,
    });

    await auditService.record(
      {
        action: "paper.create",
        resourceType: "paper",
        resourceId: paper._id.toString(),
        metadata: {
          mode: "AUTO",
          requested: generated.requested,
          selected: generated.selected,
          warnings: generated.warnings.length,
        },
      },
      context,
    );

    return { paper, warnings: generated.warnings };
  },

  async update(
    id: string,
    input: UpdatePaperInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<PaperDoc> {
    const existing = await paperRepository.findMetaById(id);
    if (!existing || !existing.isActive) throw new NotFoundError("Paper");

    if (!canActOnResource(actor.role, "update", actor.id, existing.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only edit papers you created.");
    }

    if (existing.status === "ARCHIVED") {
      throw new ConflictError("Restore this paper before editing it.");
    }

    const update: Record<string, unknown> = { ...input, updatedBy: actor.objectId };

    // `findById` populates category/subject, so a plain `.toString()` on the
    // result yields "[object Object]" rather than the id — this pulls the id
    // back out regardless of whether the field is populated or a bare ObjectId.
    const idOf = (value: { _id: Types.ObjectId } | Types.ObjectId): string =>
      value instanceof Types.ObjectId ? value.toString() : value._id.toString();

    if (input.category || input.subject) {
      const current = await paperRepository.findById(id);
      if (!current) throw new NotFoundError("Paper");

      await assertTaxonomy({
        category: input.category ?? idOf(current.category),
        subject: input.subject ?? idOf(current.subject),
      });
    }

    let totals = { totalMarks: 0, totalQuestions: 0 };

    if (input.sections) {
      const current = await paperRepository.findById(id);
      if (!current) throw new NotFoundError("Paper");

      const sections = await resolveSections({
        sections: input.sections,
        subject: input.subject ?? idOf(current.subject),
      });

      totals = computeTotals(sections);
      update.sections = sections;
      update.totalMarks = totals.totalMarks;
      update.totalQuestions = totals.totalQuestions;
    }

    const updated = await paperRepository.updateWithVersion(
      id,
      update,
      versionEntry(actor, existing.version + 1, "Edited", totals),
    );

    if (!updated) throw new NotFoundError("Paper");

    await auditService.record(
      {
        action: "paper.update",
        resourceType: "paper",
        resourceId: id,
        metadata: { version: updated.version, questions: updated.totalQuestions },
      },
      context,
    );

    return updated;
  },

  async remove(id: string, actor: AuthContext, context: AuditContext): Promise<void> {
    const existing = await paperRepository.findMetaById(id);
    if (!existing || !existing.isActive) throw new NotFoundError("Paper");

    if (!canActOnResource(actor.role, "delete", actor.id, existing.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only delete papers you created.");
    }

    await paperRepository.softDeleteById(id, actor.objectId);

    await auditService.record(
      {
        action: "paper.delete",
        resourceType: "paper",
        resourceId: id,
        metadata: { title: existing.title },
      },
      context,
    );

    logger.info("Paper deactivated", { paperId: id, actorId: actor.id });
  },

  /* ------------------------------- Lifecycle ------------------------------- */

  async changeStatus(
    id: string,
    target: PaperStatus,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<PaperDoc> {
    const existing = await paperRepository.findMetaById(id);
    if (!existing || !existing.isActive) throw new NotFoundError("Paper");

    const isOwner = existing.createdBy.toString() === actor.id;

    // Publishing is a privileged act; archiving and restoring stay with the owner.
    if (target === "PUBLISHED" && !can(actor.role, "paper:publish")) {
      throw new ForbiddenError("You do not have permission to publish papers.");
    }

    if (
      target !== "PUBLISHED" &&
      !canActOnResource(actor.role, "update", actor.id, existing.createdBy.toString(), "paper")
    ) {
      throw new ForbiddenError("You may only change papers you created.");
    }

    if (!canTransitionPaper(existing.status, target)) {
      throw new ValidationError("That status change is not allowed.", [
        { path: "status", message: `Cannot move from ${existing.status} to ${target}.` },
      ]);
    }

    const update: Record<string, unknown> = { status: target, updatedBy: actor.objectId };

    if (target === "PUBLISHED") {
      const full = await paperRepository.findMetaById(id);
      const counts = await paperRepository.findById(id);

      if (!full || !counts) throw new NotFoundError("Paper");
      if (counts.totalQuestions === 0) {
        throw new ConflictError("A paper must contain at least one question before publishing.");
      }

      update.publishedBy = actor.objectId;
      update.publishedAt = new Date();
      update.archivedAt = null;
    }

    if (target === "ARCHIVED") update.archivedAt = new Date();
    if (target === "DRAFT") {
      update.archivedAt = null;
      update.publishedAt = null;
      update.publishedBy = null;
    }

    const summaryByTarget: Record<PaperStatus, string> = {
      PUBLISHED: "Published",
      ARCHIVED: "Archived",
      DRAFT: "Restored to draft",
    };

    const updated = await paperRepository.updateWithVersion(
      id,
      update,
      versionEntry(actor, existing.version + 1, summaryByTarget[target], {
        totalMarks: 0,
        totalQuestions: 0,
      }),
    );

    if (!updated) throw new NotFoundError("Paper");

    const actionByTarget = {
      PUBLISHED: "paper.publish",
      ARCHIVED: "paper.archive",
      DRAFT: "paper.restore",
    } as const;

    await auditService.record(
      {
        action: actionByTarget[target],
        resourceType: "paper",
        resourceId: id,
        metadata: { from: existing.status, to: target, owner: isOwner },
      },
      context,
    );

    return updated;
  },

  async clone(
    id: string,
    actor: AuthContext,
    context: AuditContext,
    newTitle?: string,
  ): Promise<PaperDoc> {
    assertPermission(actor, "paper:create");

    const source = await paperRepository.findById(id);
    if (!source || !source.isActive) throw new NotFoundError("Paper");
    assertCanView(source, actor);

    const totals = { totalMarks: source.totalMarks, totalQuestions: source.totalQuestions };

    const clone = await paperRepository.create({
      title: newTitle?.trim() || `${source.title} (copy)`,
      description: source.description,
      instructions: source.instructions,
      category: source.category,
      subject: source.subject,
      board: source.board,
      exam: source.exam,
      year: source.year,
      durationMinutes: source.durationMinutes,
      // Structured clone of the section tree; ids only, no populated bodies.
      sections: source.sections.map((section) => ({
        title: section.title,
        instructions: section.instructions,
        order: section.order,
        questions: section.questions.map((entry) => ({
          question: entry.question,
          order: entry.order,
          marks: entry.marks,
          note: entry.note,
        })),
      })),
      generationSpec: source.generationSpec,
      mode: source.mode,
      // A clone always starts as a fresh draft owned by whoever cloned it.
      status: "DRAFT",
      version: 1,
      versionHistory: [versionEntry(actor, 1, `Cloned from ${source.title}`, totals)],
      clonedFrom: source._id,
      ...totals,
      createdBy: actor.objectId,
    });

    await auditService.record(
      {
        action: "paper.clone",
        resourceType: "paper",
        resourceId: clone._id.toString(),
        metadata: { sourceId: id },
      },
      context,
    );

    return clone;
  },
};

export type PaperService = typeof paperService;
