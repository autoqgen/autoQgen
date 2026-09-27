import { type AuthContext } from "@/lib/auth/session";
import { assertPermissionOrOrgMembership, requireContentOrganizationId } from "@/lib/auth/org-session";
import { ValidationError } from "@/lib/errors/app-error";
import { questionContentHash } from "@/lib/security/hash";
import { questionRepository } from "@/lib/repositories/question.repo";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { loadHierarchyContext, validateHierarchyRefs } from "@/lib/services/question.service";
import { questionGenerationOllamaClient } from "@/lib/ai/question-generation-ollama";
import {
  buildCreativeQuestionPrompt,
  buildCreativeQuestionReviewPrompt,
  buildQuestionPrompt,
  QUESTION_SYSTEM_PROMPT,
} from "@/lib/ai/question-prompt";
import {
  normaliseAiReply,
  type NormalisedQuestion,
  validateCreativeGroupStructure,
} from "@/lib/ai/question-normalise";
import { logger } from "@/lib/logger";
import { Organization } from "@/models";
import type {
  AiCheckDuplicatesInput,
  AiGenerateCreativeGroupInput,
  AiGenerateQuestionsInput,
} from "@/lib/validation/ai-question.schema";
import { AI_QUESTION_TYPES } from "@/types/question";

/**
 * "AI Generated Questions" — the generate and duplicate-check half of the
 * feature. Persisting the user's selection is `questionService.aiImport`.
 *
 * Organization isolation is absolute: the target organization is resolved from
 * the caller's session (`requireContentOrganizationId`), every taxonomy id is
 * validated against it, and duplicate detection only ever looks at that
 * organization's question bank. No `organizationId` is accepted from the client.
 */

export type AiCandidateStatus = "new" | "duplicate" | "needs_review";

export interface AiGeneratedCandidate {
  /** Stable within one response; the client key for selection/edit. */
  tempId: string;
  status: AiCandidateStatus;
  question: NormalisedQuestion;
  /** Non-empty when `status === "needs_review"`. */
  issues: string[];
  /** Existing question id when `status === "duplicate"`. */
  duplicateOf: string | null;
}

export interface AiGenerateTaxonomy {
  categoryId: string;
  categoryName: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
  topicId: string | null;
  topicName: string | null;
}

export interface AiGenerateResult {
  organizationId: string;
  organizationName: string;
  model: string;
  taxonomy: AiGenerateTaxonomy;
  requested: number;
  generated: number;
  newCount: number;
  duplicateCount: number;
  needsReviewCount: number;
  questions: AiGeneratedCandidate[];
}

export interface AiDuplicateCheckItem {
  index: number;
  duplicate: boolean;
  duplicateOf: string | null;
}

export interface AiGeneratedCreativeGroup {
  organizationId: string;
  organizationName: string;
  model: string;
  taxonomy: AiGenerateTaxonomy;
  stimulus: string;
  parts: { question: NormalisedQuestion; issues: string[] }[];
  issues: string[];
  qualityAttempts: number;
}

function isMalformedAiJson(error: unknown): boolean {
  return error instanceof Error && error.message === "The AI service returned malformed JSON.";
}

async function resolvePlacement(
  organizationId: string,
  input: { category: string; subject: string; chapter: string; topic: string | null },
): Promise<AiGenerateTaxonomy> {
  const refs = {
    category: input.category,
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    board: null,
    exam: null,
  };

  const hierarchyContext = await loadHierarchyContext([refs], organizationId);
  const hierarchyIssues = validateHierarchyRefs(refs, hierarchyContext);
  if (hierarchyIssues.length > 0) {
    throw new ValidationError("The selected taxonomy is invalid.", hierarchyIssues);
  }

  // Names for the prompt and the card display. Scoped to the organization, so a
  // foreign id would already have failed validation above.
  const [category, subject, chapter, topic] = await Promise.all([
    taxonomyRepository.findById("category", input.category, organizationId),
    taxonomyRepository.findById("subject", input.subject, organizationId),
    taxonomyRepository.findById("chapter", input.chapter, organizationId),
    input.topic
      ? taxonomyRepository.findById("topic", input.topic, organizationId)
      : Promise.resolve(null),
  ]);

  if (!category || !subject || !chapter) {
    throw new ValidationError("The selected taxonomy is invalid.", [
      { path: "chapter", message: "The category, subject or chapter could not be found." },
    ]);
  }

  return {
    categoryId: category._id.toString(),
    categoryName: category.name,
    subjectId: subject._id.toString(),
    subjectName: subject.name,
    chapterId: chapter._id.toString(),
    chapterName: chapter.name,
    topicId: topic ? topic._id.toString() : null,
    topicName: topic ? topic.name : null,
  };
}

export const aiQuestionService = {
  get available(): boolean {
    return questionGenerationOllamaClient.enabled;
  },

  async generate(
    input: AiGenerateQuestionsInput,
    actor: AuthContext,
    context?: AuditContext,
  ): Promise<AiGenerateResult> {
    await assertPermissionOrOrgMembership(actor, "question:generate-ai", "question:generate-ai");

    const organizationId = await requireContentOrganizationId(actor);
    const taxonomy = await resolvePlacement(organizationId, {
      category: input.category,
      subject: input.subject,
      chapter: input.chapter,
      topic: input.topic ?? null,
    });

    const org = await Organization.findById(organizationId).select("name").lean().exec();
    const organizationName = org?.name ?? "Your organization";

    const prompt = buildQuestionPrompt({
      categoryName: taxonomy.categoryName,
      subjectName: taxonomy.subjectName,
      chapterName: taxonomy.chapterName,
      topicName: taxonomy.topicName,
      type: input.type,
      difficulty: input.difficulty ?? null,
      language: input.language,
      count: input.count,
      instruction: input.instruction,
    });

    const reply = await questionGenerationOllamaClient.generateJson({
      system: QUESTION_SYSTEM_PROMPT,
      prompt,
    });

    const normalised = normaliseAiReply({
      reply,
      requestedType: input.type,
      requestedDifficulty: input.difficulty ?? null,
      limit: input.count,
    });

    // Duplicate detection — this organization's bank only.
    const hashes = normalised.map((candidate) =>
      questionContentHash(taxonomy.chapterId, candidate.question.question.text),
    );
    const existing = await questionRepository.findByHashes(hashes, organizationId);

    const seenInBatch = new Set<string>();
    const questions: AiGeneratedCandidate[] = normalised.map((candidate, index) => {
      const hash = hashes[index]!;
      let status: AiCandidateStatus;
      let duplicateOf: string | null = null;

      if (candidate.issues.length > 0 || !candidate.question.question.text) {
        status = "needs_review";
      } else if (existing.has(hash)) {
        status = "duplicate";
        duplicateOf = existing.get(hash) ?? null;
      } else if (seenInBatch.has(hash)) {
        status = "duplicate";
      } else {
        status = "new";
      }
      seenInBatch.add(hash);

      return {
        tempId: `ai-${index}`,
        status,
        question: candidate.question,
        issues: candidate.issues,
        duplicateOf,
      };
    });

    const result: AiGenerateResult = {
      organizationId,
      organizationName,
      model: questionGenerationOllamaClient.model,
      taxonomy,
      requested: input.count,
      generated: questions.length,
      newCount: questions.filter((question) => question.status === "new").length,
      duplicateCount: questions.filter((question) => question.status === "duplicate").length,
      needsReviewCount: questions.filter((question) => question.status === "needs_review").length,
      questions,
    };

    logger.info("AI questions generated", {
      actorId: actor.id,
      chapter: taxonomy.chapterId,
      requested: result.requested,
      generated: result.generated,
      newCount: result.newCount,
      duplicateCount: result.duplicateCount,
      needsReviewCount: result.needsReviewCount,
    });

    if (context) {
      await auditService.record(
        {
          action: "question.ai-generate",
          resourceType: "question",
          metadata: {
            chapter: taxonomy.chapterId,
            type: input.type,
            requested: result.requested,
            generated: result.generated,
          },
        },
        context,
      );
    }

    return result;
  },

  async generateCreativeGroup(
    input: AiGenerateCreativeGroupInput,
    actor: AuthContext,
  ): Promise<AiGeneratedCreativeGroup> {
    await assertPermissionOrOrgMembership(actor, "question:generate-ai", "question:generate-ai");
    const organizationId = await requireContentOrganizationId(actor);
    const taxonomy = await resolvePlacement(organizationId, {
      category: input.category,
      subject: input.subject,
      chapter: input.chapter,
      topic: input.topic ?? null,
    });
    const org = await Organization.findById(organizationId).select("name").lean().exec();
    const promptContext = {
      categoryName: taxonomy.categoryName,
      subjectName: taxonomy.subjectName,
      chapterName: taxonomy.chapterName,
      topicName: taxonomy.topicName,
      difficulty: input.difficulty ?? null,
      language: input.language,
      instruction: input.instruction,
    };
    const partLabels = ["ক", "খ", "গ", "ঘ"] as const;
    const cognitiveLevels = ["knowledge", "understanding", "application", "higher_order"] as const;
    let stimulus = "";
    let parts: AiGeneratedCreativeGroup["parts"] = [];
    let issues: string[] = [];
    let qualityAttempts = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      qualityAttempts = attempt + 1;
      let reply: unknown;
      try {
        reply = await questionGenerationOllamaClient.generateJson({
          system: QUESTION_SYSTEM_PROMPT,
          prompt: buildCreativeQuestionPrompt({
            ...promptContext,
            retryFeedback: attempt > 0 ? issues : [],
          }),
        });
      } catch (error) {
        if (!isMalformedAiJson(error)) throw error;
        stimulus = "";
        parts = [];
        issues = ["The AI returned malformed JSON; regenerate the CQ as valid JSON with one stimulus and exactly four parts."];
        continue;
      }
      const data = (reply ?? {}) as Record<string, unknown>;
      stimulus = typeof data.stimulus === "string" ? data.stimulus.trim() : "";
      const rawParts = Array.isArray(data.parts) ? data.parts : [];
      const localIssues: string[] = [];
      if (!stimulus) localIssues.push("The generated stimulus is empty.");
      if (rawParts.length !== 4) localIssues.push("The AI did not return exactly four CQ parts.");

      const parsedParts = rawParts.slice(0, 4).map((raw, index) => {
        const record = (raw ?? {}) as Record<string, unknown>;
        const isSupported = typeof record.type === "string" &&
          (AI_QUESTION_TYPES as readonly string[]).includes(record.type);
        const type = isSupported
          ? record.type as (typeof AI_QUESTION_TYPES)[number]
          : "WRITTEN";
        if (!isSupported) {
          localIssues.push(`Part ${partLabels[index] ?? index + 1} uses an unsupported question type.`);
        }
        if (record.label !== partLabels[index]) {
          localIssues.push(`Part ${partLabels[index] ?? index + 1} has an incorrect or missing label.`);
        }
        if (record.cognitiveLevel !== cognitiveLevels[index]) {
          localIssues.push(`Part ${partLabels[index] ?? index + 1} does not match its required cognitive level.`);
        }
        if (Number(record.marks) !== index + 1) {
          localIssues.push(`Part ${partLabels[index] ?? index + 1} must be worth ${index + 1} mark(s).`);
        }
        const normalized = normaliseAiReply({
          reply: { questions: [{ ...record, type }] },
          requestedType: type,
          requestedDifficulty: input.difficulty ?? null,
          limit: 1,
        })[0]!;
        return {
          question: { ...normalized.question, marks: index + 1 },
          issues: isSupported ? normalized.issues : ["Unsupported question type."],
          rawRecord: record,
        };
      });

      parts = parsedParts.map(({ question, issues: partIssues }) => ({ question, issues: partIssues }));
      localIssues.push(...parsedParts.flatMap(({ issues: partIssues }, index) =>
        partIssues.map((issue) => `Part ${partLabels[index]}: ${issue}`),
      ));
      localIssues.push(...validateCreativeGroupStructure({
        stimulus,
        parts: parts.map((part) => part.question),
      }));

      const hashes = parts.map(({ question }) =>
        questionContentHash(taxonomy.chapterId, question.question.text),
      );
      const existing = await questionRepository.findByHashes(hashes, organizationId);
      if (new Set(hashes).size !== hashes.length || hashes.some((hash) => existing.has(hash))) {
        localIssues.push("One or more CQ parts duplicate a question already in the Question Bank.");
      }

      let reviewIssues: string[] = [];
      if (localIssues.length === 0) {
        try {
          const review = await questionGenerationOllamaClient.generateJson<{
            pass?: unknown;
            issues?: unknown;
            partIssues?: unknown;
          }>({
            system: "You are a strict, independent academic reviewer. Assess the content critically and return the requested JSON only.",
            prompt: buildCreativeQuestionReviewPrompt({
              categoryName: taxonomy.categoryName,
              subjectName: taxonomy.subjectName,
              chapterName: taxonomy.chapterName,
              topicName: taxonomy.topicName,
              stimulus,
              parts: parts.map(({ question }, index) => ({
                label: partLabels[index]!,
                cognitiveLevel: cognitiveLevels[index]!,
                marks: index + 1,
                type: question.type,
                text: question.question.text,
                options: question.options.map((option) => option.text),
                answer: question.type === "MCQ" || question.type === "MULTIPLE_CORRECT"
                  ? question.answer.correctOptions
                    .map((id) => question.options.find((option) => option.id === id)?.text ?? id)
                  : question.type === "TRUE_FALSE"
                    ? [question.answer.booleanAnswer ? "True" : "False"]
                    : [question.answer.text],
              })),
            }),
            temperature: 0,
            maxOutputTokens: 2048,
          });
          const reviewIssuesFromModel = Array.isArray(review.issues)
            ? review.issues.filter((issue): issue is string => typeof issue === "string" && Boolean(issue.trim()))
            : [];
          const hasValidIssueList = Array.isArray(review.issues) &&
            review.issues.every((issue) => typeof issue === "string");
          const hasValidPartIssues = Array.isArray(review.partIssues) &&
            review.partIssues.length === partLabels.length &&
            review.partIssues.every((partIssues) =>
              Array.isArray(partIssues) &&
              partIssues.every((issue) => typeof issue === "string"),
            );
          const reviewPartIssues = Array.isArray(review.partIssues)
            ? review.partIssues.flatMap((partIssues, index) =>
                Array.isArray(partIssues)
                  ? partIssues
                      .filter((issue): issue is string => typeof issue === "string" && Boolean(issue.trim()))
                      .map((issue) => `Part ${partLabels[index] ?? index + 1}: ${issue}`)
                  : [],
              )
            : [];
          if (
            review.pass !== true ||
            !hasValidIssueList ||
            !hasValidPartIssues ||
            reviewIssuesFromModel.length > 0 ||
            reviewPartIssues.length > 0
          ) {
            reviewIssues = reviewIssuesFromModel.length > 0
              ? [...reviewIssuesFromModel, ...reviewPartIssues]
              : reviewPartIssues.length > 0
                ? reviewPartIssues
                : ["The CQ did not receive a complete, valid approval from the independent quality review; verify factual accuracy, stimulus connection, progression, and answers."];
          }
        } catch (error) {
          if (!isMalformedAiJson(error)) throw error;
          reviewIssues = ["The independent quality review returned malformed JSON; regenerate and review the CQ again."];
        }
      }

      issues = [...localIssues, ...reviewIssues];
      if (issues.length === 0) break;
    }

    const result: AiGeneratedCreativeGroup = {
      organizationId,
      organizationName: org?.name ?? "Your organization",
      model: questionGenerationOllamaClient.model,
      taxonomy,
      stimulus,
      parts,
      issues,
      qualityAttempts,
    };
    logger.info("AI creative question generated", {
      actorId: actor.id,
      chapter: taxonomy.chapterId,
      validParts: parts.filter((part) => part.issues.length === 0).length,
      qualityAttempts,
      passedQualityReview: issues.length === 0,
    });
    return result;
  },

  /**
   * Re-check duplicate status for a set of question texts after the user edits
   * them. Cheap: one hash per text, one indexed query, no AI call.
   */
  async checkDuplicates(
    input: AiCheckDuplicatesInput,
    actor: AuthContext,
  ): Promise<AiDuplicateCheckItem[]> {
    await assertPermissionOrOrgMembership(actor, "question:generate-ai", "question:generate-ai");

    const organizationId = await requireContentOrganizationId(actor);

    const chapter = await taxonomyRepository.findById("chapter", input.chapter, organizationId);
    if (!chapter) {
      throw new ValidationError("The selected taxonomy is invalid.", [
        { path: "chapter", message: "The selected chapter does not exist." },
      ]);
    }

    const hashes = input.texts.map((text) => questionContentHash(input.chapter, text));
    const existing = await questionRepository.findByHashes(hashes, organizationId);

    return input.texts.map((_text, index) => {
      const hash = hashes[index]!;
      return {
        index,
        duplicate: existing.has(hash),
        duplicateOf: existing.get(hash) ?? null,
      };
    });
  },
};

export type AiQuestionService = typeof aiQuestionService;
