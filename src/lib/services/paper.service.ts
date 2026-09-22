import { Types, type QueryFilter as FilterQuery, type SortOrder } from "mongoose";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type FieldIssue,
} from "@/lib/errors/app-error";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import {
  assertPermissionOrOrgMembership,
  requireContentOrganizationId,
  resolveContentOrganizationId,
} from "@/lib/auth/org-session";
import { can, canActOnResource } from "@/lib/auth/rbac";
import { paperRepository, type PaperDoc } from "@/lib/repositories/paper.repo";
import { questionRepository } from "@/lib/repositories/question.repo";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { paperGeneratorService } from "@/lib/services/paper-generator.service";
import { questionUsageService } from "@/lib/services/question-usage.service";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { toSkip } from "@/lib/validation/common";
import { escapeRegExp } from "@/lib/security/regex";
import { logger } from "@/lib/logger";
import { canTransitionPaper, type PaperStatus } from "@/types/paper";
import { MAX_QUESTIONS_PER_PAPER } from "@/lib/validation/paper.schema";
import { QuestionPaper, type IQuestionPaper, type PaperType } from "@/models";
import { DEFAULT_PAPER_DESIGN } from "@/lib/validation/paper.schema";
import type {
  CreatePaperInput,
  GenerateAndSavePaperInput,
  GeneratePaperInput,
  PaperDesignInput,
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

/** Flattens a paper's sections to the distinct question ObjectIds they contain. */
function questionIdsOf(
  sections: readonly { questions: readonly { question: unknown }[] }[],
): Types.ObjectId[] {
  const seen = new Set<string>();
  const out: Types.ObjectId[] = [];
  for (const section of sections) {
    for (const entry of section.questions) {
      const raw = entry.question;
      const oid =
        raw instanceof Types.ObjectId
          ? raw
          : new Types.ObjectId(
              String(
                raw && typeof raw === "object" && "_id" in raw
                  ? (raw as { _id: unknown })._id
                  : raw,
              ),
            );
      const key = oid.toString();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(oid);
      }
    }
  }
  return out;
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
  input: { sections: CreatePaperInput["sections"]; subject: string; organizationId: string },
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

  // One batched lookup for the whole paper, scoped to the paper's organization
  // so a question from another tenant is treated as "no longer exists".
  const docs = await questionRepository.findForPaper(allIds, input.organizationId);
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

async function assertTaxonomy(
  input: { category: string; subject: string },
  organizationId: string,
): Promise<void> {
  const subject = await taxonomyRepository.findById("subject", input.subject, organizationId);

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

function buildListFilter(
  query: PaperListQuery,
  actor: AuthContext,
  organizationId: string,
): FilterQuery<IQuestionPaper> {
  const filter: FilterQuery<IQuestionPaper> = {
    isActive: true,
    organizationId: new Types.ObjectId(organizationId),
  };

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

type GenerationResult = Awaited<ReturnType<typeof paperGeneratorService.generate>>;

/** The generator's picks as a single normalised section. */
function sectionsFromGenerated(generated: GenerationResult): NormalisedSection[] {
  return [
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
}

/** The full smart-generation config, exactly as persisted on `paper.generationSpec`. */
function persistedSpec(spec: GeneratePaperInput, seed: string): Record<string, unknown> {
  return {
    category: spec.category,
    subject: spec.subject,
    board: spec.board ?? null,
    exam: spec.exam ?? null,
    year: spec.year ?? null,
    language: spec.language ?? null,
    chapters: spec.chapters,
    topics: spec.topics ?? [],
    totalQuestions: spec.totalQuestions,
    totalMarks: spec.totalMarks ?? null,
    difficultyDistribution: spec.difficultyDistribution ?? [],
    typeDistribution: spec.typeDistribution ?? [],
    chapterDistribution: spec.chapterDistribution ?? [],
    previousQuestions: spec.previousQuestions ?? { mode: "allow", percent: 100, paperRange: 0 },
    excludeRecentPapers: spec.excludeRecentPapers ?? 0,
    mandatoryQuestionIds: spec.mandatoryQuestionIds ?? [],
    excludedQuestionIds: spec.excludedQuestionIds ?? [],
    randomize: spec.randomize ?? { selection: true, order: false, options: false },
    seed,
  };
}

/**
 * Turns the generator's picks into a fresh AUTO paper, persists the complete
 * config, records usage and audits. Used only by `generateAndSave` — a
 * regeneration updates the existing paper in place (see `regenerate`).
 */
async function saveGeneratedPaper(params: {
  organizationId: string;
  spec: GeneratePaperInput;
  meta: {
    title: string;
    description: string;
    instructions: string;
    durationMinutes: number | null;
    paperType: PaperType;
  };
  generated: GenerationResult;
  designConfig: Record<string, unknown>;
  actor: AuthContext;
  context: AuditContext;
}): Promise<{ paper: PaperDoc; warnings: unknown[]; result: GenerationResult }> {
  const { organizationId, spec, meta, generated, designConfig, actor, context } = params;

  const sections = sectionsFromGenerated(generated);
  const totals = computeTotals(sections);

  const paper = await paperRepository.create({
    organizationId: new Types.ObjectId(organizationId),
    title: meta.title,
    description: meta.description,
    instructions: meta.instructions,
    category: spec.category,
    subject: spec.subject,
    board: spec.board,
    exam: spec.exam,
    year: spec.year,
    durationMinutes: meta.durationMinutes,
    sections,
    ...totals,
    mode: "AUTO",
    status: "DRAFT",
    generationSpec: persistedSpec(spec, generated.seed),
    designConfig,
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

  return { paper, warnings: generated.warnings, result: generated };
}

export const paperService = {
  async list(
    query: PaperListQuery,
    actor: AuthContext,
  ): Promise<{ items: PaperDoc[]; total: number }> {
    assertPermission(actor, "paper:read");

    const organizationId = await resolveContentOrganizationId(actor, query.organizationId);
    if (!organizationId) return { items: [], total: 0 };

    return paperRepository.list({
      filter: buildListFilter(query, actor, organizationId),
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
      sort: buildSort(query),
    });
  },

  async getById(
    id: string,
    actor: AuthContext,
    options?: { withAnswers?: boolean; organizationId?: string | null },
  ): Promise<PaperDoc> {
    assertPermission(actor, "paper:read");

    const organizationId = await resolveContentOrganizationId(actor, options?.organizationId);
    if (!organizationId) throw new NotFoundError("Paper");

    // Answers are only ever loaded for a caller holding the export permission.
    const withAnswers = Boolean(options?.withAnswers) && can(actor.role, "paper:export-answers");

    const paper = await paperRepository.findById(id, {
      populateQuestions: true,
      withAnswers,
      organizationId,
    });

    if (!paper || !paper.isActive) throw new NotFoundError("Paper");
    assertCanView(paper, actor);

    return paper;
  },

  async create(input: CreatePaperInput, actor: AuthContext, context: AuditContext): Promise<PaperDoc> {
    await assertPermissionOrOrgMembership(actor, "paper:create", "paper:create");

    const organizationId = await requireContentOrganizationId(actor, input.organizationId);
    await assertTaxonomy(input, organizationId);

    const sections = await resolveSections({
      sections: input.sections,
      subject: input.subject,
      organizationId,
    });
    const totals = computeTotals(sections);

    const { organizationId: _orgOverride, ...writableInput } = input;

    const paper = await paperRepository.create({
      ...writableInput,
      organizationId: new Types.ObjectId(organizationId),
      sections,
      ...totals,
      mode: "MANUAL",
      status: "DRAFT",
      createdBy: actor.objectId,
    });

    // A manually built paper is a finalized paper too: its questions count as
    // previously used for this organization, exactly like a generated one.
    // Best-effort — bookkeeping must not fail paper creation.
    try {
      await questionUsageService.syncForPaper({
        organizationId,
        questionPaperId: paper._id,
        questionIds: questionIdsOf(sections),
        paperType: "OTHER",
        createdBy: actor.objectId,
      });
    } catch (error) {
      logger.error("Failed to record question usage", {
        paperId: paper._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
  ): Promise<{ paper: PaperDoc; warnings: unknown[]; result: GenerationResult }> {
    await assertPermissionOrOrgMembership(actor, "paper:create", "paper:create");

    const organizationId = await requireContentOrganizationId(actor, input.spec.organizationId);
    await assertTaxonomy(
      { category: input.spec.category, subject: input.spec.subject },
      organizationId,
    );

    const generated = await paperGeneratorService.generate(input.spec, organizationId);

    return saveGeneratedPaper({
      organizationId,
      spec: input.spec,
      meta: {
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        durationMinutes: input.durationMinutes,
        paperType: input.paperType,
      },
      generated,
      // A Question Pattern Template may supply its own appearance config;
      // otherwise every generated paper starts from the stored default.
      designConfig:
        (input.designConfig as Record<string, unknown> | undefined) ??
        (DEFAULT_PAPER_DESIGN as unknown as Record<string, unknown>),
      actor,
      context,
    });
  },

  /**
   * Regenerate an existing AUTO paper with edited generation settings.
   *
   * Updates the SAME paper in place — new questions, new persisted config, its
   * usage rows re-synced. No new document, no version, no lineage, no title
   * change. The organization, category and subject stay locked to the paper
   * (server-resolved at its creation); only the filter settings are editable.
   * Title / description / instructions / duration / design / status are left
   * exactly as they were.
   */
  async regenerate(
    sourceId: string,
    input: GenerateAndSavePaperInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<{ paper: PaperDoc; warnings: unknown[]; result: GenerationResult }> {
    await assertPermissionOrOrgMembership(actor, "paper:create", "paper:create");

    const organizationId = await requireContentOrganizationId(actor);
    const source = await paperRepository.findGenerationMeta(sourceId, organizationId);
    if (!source || !source.isActive) throw new NotFoundError("Paper");
    if (source.mode !== "AUTO" || !source.generationSpec) {
      throw new ValidationError("Only generated papers can be regenerated.");
    }
    if (source.status === "ARCHIVED") {
      throw new ConflictError("Restore this paper before regenerating it.");
    }
    if (!canActOnResource(actor.role, "update", actor.id, source.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only regenerate papers you created.");
    }

    const idOf = (value: unknown): string =>
      value && typeof value === "object" && "_id" in value
        ? String((value as { _id: unknown })._id)
        : String(value);

    // Category / subject are locked to the paper; everything else on the spec
    // is the caller's edited configuration.
    const effectiveSpec: GeneratePaperInput = {
      ...input.spec,
      organizationId: null,
      category: idOf(source.category),
      subject: idOf(source.subject),
    };

    await assertTaxonomy(
      { category: effectiveSpec.category, subject: effectiveSpec.subject },
      organizationId,
    );

    const generated = await paperGeneratorService.generate(effectiveSpec, organizationId);

    const sections = sectionsFromGenerated(generated);
    const totals = computeTotals(sections);

    const updated = await paperRepository.updateById(sourceId, {
      sections,
      ...totals,
      generationSpec: persistedSpec(effectiveSpec, generated.seed),
      updatedBy: actor.objectId,
    });
    if (!updated) throw new NotFoundError("Paper");

    if (source.previousUsageDecision === "confirmed") {
      try {
        await questionUsageService.syncForPaper({
          organizationId,
          questionPaperId: sourceId,
          questionIds: generated.questions.map((question) => question.id),
          paperType: input.paperType,
          createdBy: actor.objectId,
        });
      } catch (error) {
        logger.error("Failed to sync question usage", {
          paperId: sourceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      await questionUsageService.clearForPapers(organizationId, [sourceId]);
    }

    await auditService.record(
      {
        action: "paper.regenerate",
        resourceType: "paper",
        resourceId: sourceId,
        metadata: {
          requested: generated.requested,
          selected: generated.selected,
          warnings: generated.warnings.length,
        },
      },
      context,
    );

    return { paper: updated, warnings: generated.warnings, result: generated };
  },

  /**
   * Swap one question for another, in place, keeping the paper's question count
   * and every other question untouched.
   *
   * Used only by the semantic-similarity "Remove & Replace" flow after it has
   * already generated and validated `newQuestionId` via `paperGeneratorService`.
   * Ownership / org / archived rules match `regenerate`; usage is re-synced to
   * the new question set exactly as `regenerate` does. `contentHash` and the
   * questions themselves are never modified.
   */
  async swapQuestion(
    paperId: string,
    removeQuestionId: string,
    newQuestionId: string,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<PaperDoc> {
    const organizationId = await requireContentOrganizationId(actor);

    const paper = await paperRepository.findById(paperId, { organizationId });
    if (!paper || !paper.isActive) throw new NotFoundError("Paper");
    if (!canActOnResource(actor.role, "update", actor.id, paper.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only edit papers you created.");
    }
    if (paper.status === "ARCHIVED") {
      throw new ConflictError("Restore this paper before editing it.");
    }

    const idOf = (value: unknown): string =>
      value && typeof value === "object" && "_id" in value
        ? String((value as { _id: unknown })._id)
        : String(value);

    // Locate the entry being replaced.
    let found = false;
    const sections: NormalisedSection[] = paper.sections.map((section) => ({
      title: section.title ?? "",
      instructions: section.instructions ?? "",
      order: section.order,
      questions: section.questions.map((entry) => {
        if (!found && idOf(entry.question) === removeQuestionId) {
          found = true;
          return {
            question: new Types.ObjectId(newQuestionId),
            order: entry.order,
            // marks filled in below once the new question is loaded
            marks: entry.marks,
            note: "",
          };
        }
        return {
          question:
            entry.question instanceof Types.ObjectId
              ? entry.question
              : new Types.ObjectId(idOf(entry.question)),
          order: entry.order,
          marks: entry.marks,
          note: entry.note ?? "",
        };
      }),
    }));

    if (!found) {
      throw new NotFoundError("Question in this paper");
    }

    // The replacement must be an APPROVED, active question in this organization.
    const [replacement] = await questionRepository.findForPaper([newQuestionId], organizationId);
    if (!replacement || !replacement.isActive || replacement.status !== "APPROVED") {
      throw new ValidationError("The replacement question is not eligible for this paper.");
    }
    for (const section of sections) {
      for (const entry of section.questions) {
        if (entry.question.toString() === newQuestionId) entry.marks = replacement.marks ?? entry.marks;
      }
    }

    const totals = computeTotals(sections);

    const updated = await paperRepository.updateById(paperId, {
      sections,
      ...totals,
      updatedBy: actor.objectId,
    });
    if (!updated) throw new NotFoundError("Paper");

    // Generated papers only enter the previous-question pool after explicit
    // confirmation; manual papers retain their existing bookkeeping behavior.
    if (paper.mode !== "AUTO" || paper.previousUsageDecision === "confirmed") {
      try {
        await questionUsageService.syncForPaper({
          organizationId,
          questionPaperId: paperId,
          questionIds: questionIdsOf(sections).map((oid) => oid.toString()),
          paperType: "OTHER",
          createdBy: actor.objectId,
        });
      } catch (error) {
        logger.error("Failed to sync question usage after similarity swap", {
          paperId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await auditService.record(
      {
        action: "paper.similarity-replace",
        resourceType: "paper",
        resourceId: paperId,
        metadata: { removed: removeQuestionId, added: newQuestionId },
      },
      context,
    );

    return updated;
  },

  /**
   * Save the paper's Design (appearance) configuration. Persists `designConfig`
   * only — never regenerates questions, never touches QuestionUsage, never
   * bumps the paper version. Org-scoped and ownership-checked like any edit.
   */
  async updateDesign(
    id: string,
    design: PaperDesignInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<PaperDoc> {
    const organizationId = await requireContentOrganizationId(actor);

    const existing = await paperRepository.findMetaById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundError("Paper");
    if (!canActOnResource(actor.role, "update", actor.id, existing.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only edit papers you created.");
    }

    const updated = await paperRepository.updateById(id, {
      designConfig: design,
      updatedBy: actor.objectId,
    });
    if (!updated) throw new NotFoundError("Paper");

    await auditService.record(
      { action: "paper.update", resourceType: "paper", resourceId: id, metadata: { design: true } },
      context,
    );

    return updated;
  },

  async setPreviousUsageDecision(
    id: string,
    decision: "confirmed" | "declined",
    actor: AuthContext,
    context: AuditContext,
  ): Promise<{ decision: "confirmed" | "declined" }> {
    const organizationId = await requireContentOrganizationId(actor);
    const paper = await paperRepository.findById(id, { organizationId });
    if (!paper || !paper.isActive) throw new NotFoundError("Paper");
    if (paper.mode !== "AUTO") {
      throw new ValidationError("Only generated papers require a previous-question decision.");
    }
    if (paper.previousUsageDecision) {
      return { decision: paper.previousUsageDecision };
    }

    const updated = await QuestionPaper.findOneAndUpdate(
      { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId), previousUsageDecision: null },
      { $set: { previousUsageDecision: decision, updatedBy: actor.objectId } },
      { new: true, runValidators: true },
    )
      .select("previousUsageDecision")
      .lean<{ previousUsageDecision: "confirmed" | "declined" }>()
      .exec();

    if (!updated) {
      const current = await paperRepository.findById(id, { organizationId });
      if (!current?.previousUsageDecision) throw new ConflictError("Could not save the previous-question decision.");
      return { decision: current.previousUsageDecision };
    }

    if (decision === "confirmed") {
      try {
        await questionUsageService.recordForPaper({
          organizationId,
          questionPaperId: id,
          questionIds: questionIdsOf(paper.sections),
          paperType: "OTHER",
          createdBy: actor.objectId,
        });
      } catch (error) {
        await QuestionPaper.updateOne(
          { _id: new Types.ObjectId(id), organizationId: new Types.ObjectId(organizationId), previousUsageDecision: "confirmed" },
          { $set: { previousUsageDecision: null } },
        ).exec();
        logger.error("Failed to record confirmed paper usage", {
          paperId: id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new ConflictError("Could not record previous-question usage.");
      }
    }

    await auditService.record(
      {
        action: "paper.update",
        resourceType: "paper",
        resourceId: id,
        metadata: { previousUsageDecision: decision },
      },
      context,
    );

    return { decision: updated.previousUsageDecision };
  },

  async update(
    id: string,
    input: UpdatePaperInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<PaperDoc> {
    const organizationId = await requireContentOrganizationId(actor, input.organizationId);

    const existing = await paperRepository.findMetaById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundError("Paper");

    if (!canActOnResource(actor.role, "update", actor.id, existing.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only edit papers you created.");
    }

    if (existing.status === "ARCHIVED") {
      throw new ConflictError("Restore this paper before editing it.");
    }

    const { organizationId: _orgOverride, ...writableInput } = input;
    const update: Record<string, unknown> = { ...writableInput, updatedBy: actor.objectId };

    // `findById` populates category/subject, so a plain `.toString()` on the
    // result yields "[object Object]" rather than the id — this pulls the id
    // back out regardless of whether the field is populated or a bare ObjectId.
    const idOf = (value: { _id: Types.ObjectId } | Types.ObjectId): string =>
      value instanceof Types.ObjectId ? value.toString() : value._id.toString();

    if (input.category || input.subject) {
      const current = await paperRepository.findById(id, { organizationId });
      if (!current) throw new NotFoundError("Paper");

      await assertTaxonomy(
        {
          category: input.category ?? idOf(current.category),
          subject: input.subject ?? idOf(current.subject),
        },
        organizationId,
      );
    }

    let totals = { totalMarks: 0, totalQuestions: 0 };

    if (input.sections) {
      const current = await paperRepository.findById(id, { organizationId });
      if (!current) throw new NotFoundError("Paper");

      const sections = await resolveSections({
        sections: input.sections,
        subject: input.subject ?? idOf(current.subject),
        organizationId,
      });

      totals = computeTotals(sections);
      update.sections = sections;
      update.totalMarks = totals.totalMarks;
      update.totalQuestions = totals.totalQuestions;
    }

    const updated = await paperRepository.updateById(id, update);

    if (!updated) throw new NotFoundError("Paper");

    // The edited paper is the authoritative state. Re-sync its usage so it
    // matches the final question set exactly: questions added by the edit
    // become previously-used, questions removed stop counting. Only the paper's
    // own rows are touched, and only when the question set actually changed.
    if (input.sections) {
      try {
        await questionUsageService.syncForPaper({
          organizationId,
          questionPaperId: id,
          questionIds: questionIdsOf(updated.sections ?? []),
          createdBy: actor.objectId,
        });
      } catch (error) {
        logger.error("Failed to sync question usage", {
          paperId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await auditService.record(
      {
        action: "paper.update",
        resourceType: "paper",
        resourceId: id,
        metadata: { questions: updated.totalQuestions },
      },
      context,
    );

    return updated;
  },

  async remove(id: string, actor: AuthContext, context: AuditContext): Promise<void> {
    const organizationId = await requireContentOrganizationId(actor);

    const existing = await paperRepository.findMetaById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundError("Paper");

    if (!canActOnResource(actor.role, "delete", actor.id, existing.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only delete papers you created.");
    }

    await paperRepository.softDeleteById(id, actor.objectId);

    // A deleted paper is no longer a finalized paper: its questions must stop
    // counting as previously used and it must stop appearing among recent papers.
    try {
      await questionUsageService.clearForPapers(organizationId, [id]);
    } catch (error) {
      logger.error("Failed to clear question usage", {
        paperId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
    const organizationId = await requireContentOrganizationId(actor);

    const existing = await paperRepository.findMetaById(id, organizationId);
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
      const full = await paperRepository.findMetaById(id, organizationId);
      const counts = await paperRepository.findById(id, { organizationId });

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

    const updated = await paperRepository.updateById(id, update);

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

    const organizationId = await requireContentOrganizationId(actor);

    const source = await paperRepository.findById(id, { organizationId });
    if (!source || !source.isActive) throw new NotFoundError("Paper");
    assertCanView(source, actor);

    const totals = { totalMarks: source.totalMarks, totalQuestions: source.totalQuestions };

    const clone = await paperRepository.create({
      organizationId: new Types.ObjectId(organizationId),
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
