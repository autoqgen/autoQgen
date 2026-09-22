import { assertPermission, type AuthContext } from "@/lib/auth/session";
import { requireContentOrganizationId } from "@/lib/auth/org-session";
import { ValidationError } from "@/lib/errors/app-error";
import { questionContentHash } from "@/lib/security/hash";
import { questionRepository } from "@/lib/repositories/question.repo";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { loadHierarchyContext, validateHierarchyRefs } from "@/lib/services/question.service";
import { questionGenerationOllamaClient } from "@/lib/ai/question-generation-ollama";
import { buildQuestionPrompt, QUESTION_SYSTEM_PROMPT } from "@/lib/ai/question-prompt";
import {
  normaliseAiReply,
  type NormalisedQuestion,
} from "@/lib/ai/question-normalise";
import { logger } from "@/lib/logger";
import { Organization } from "@/models";
import type {
  AiCheckDuplicatesInput,
  AiGenerateQuestionsInput,
} from "@/lib/validation/ai-question.schema";

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
    assertPermission(actor, "question:generate-ai");

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

  /**
   * Re-check duplicate status for a set of question texts after the user edits
   * them. Cheap: one hash per text, one indexed query, no AI call.
   */
  async checkDuplicates(
    input: AiCheckDuplicatesInput,
    actor: AuthContext,
  ): Promise<AiDuplicateCheckItem[]> {
    assertPermission(actor, "question:generate-ai");

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
