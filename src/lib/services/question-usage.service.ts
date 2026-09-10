import { Types } from "mongoose";

import { questionUsageRepository } from "@/lib/repositories/question-usage.repo";
import { logger } from "@/lib/logger";
import type { PaperType } from "@/models";

/**
 * Records that a set of questions were used on a generated paper.
 *
 * Called from `paperService.generateAndSave` after the paper is persisted. The
 * `organizationId` is the one the paper was created under (server-resolved,
 * never client-supplied), so cross-organization usage is impossible by
 * construction.
 */
export const questionUsageService = {
  async recordForPaper(params: {
    organizationId: string;
    questionPaperId: string | Types.ObjectId;
    questionIds: readonly (string | Types.ObjectId)[];
    paperType: PaperType;
    createdBy?: Types.ObjectId | null;
  }): Promise<number> {
    const { organizationId, questionPaperId, questionIds, paperType, createdBy } = params;
    if (questionIds.length === 0) return 0;

    const usedAt = new Date();
    const recorded = await questionUsageRepository.recordMany(
      questionIds.map((questionId) => ({
        questionId,
        questionPaperId,
        organizationId,
        paperType,
        usedAt,
        createdBy: createdBy ?? null,
      })),
    );

    logger.info("Question usage recorded", {
      questionPaperId: questionPaperId.toString(),
      organizationId,
      questions: questionIds.length,
      newRows: recorded,
    });

    return recorded;
  },

  /**
   * Makes a paper's usage rows exactly match its final question set.
   *
   * Called after a paper's questions are persisted through an edit (or a manual
   * paper is created): every current question is upserted (idempotently) and
   * any row for a question no longer in the paper is removed. The paper's
   * existing `paperType` is preserved when one was already recorded.
   */
  async syncForPaper(params: {
    organizationId: string;
    questionPaperId: string | Types.ObjectId;
    questionIds: readonly (string | Types.ObjectId)[];
    paperType?: PaperType;
    createdBy?: Types.ObjectId | null;
  }): Promise<{ added: number; removed: number }> {
    const { organizationId, questionPaperId, questionIds, createdBy } = params;

    const paperType =
      params.paperType ??
      (await questionUsageRepository.paperTypeFor(organizationId, questionPaperId)) ??
      "OTHER";

    const usedAt = new Date();
    const added =
      questionIds.length > 0
        ? await questionUsageRepository.recordMany(
            questionIds.map((questionId) => ({
              questionId,
              questionPaperId,
              organizationId,
              paperType,
              usedAt,
              createdBy: createdBy ?? null,
            })),
          )
        : 0;

    const removed = await questionUsageRepository.deleteForPaperExcept(
      organizationId,
      questionPaperId,
      questionIds,
    );

    logger.info("Question usage synced", {
      questionPaperId: questionPaperId.toString(),
      organizationId,
      questions: questionIds.length,
      added,
      removed,
    });

    return { added, removed };
  },

  /**
   * Removes all usage recorded against the given papers. Used when a paper is
   * deleted, and when superseded regeneration rounds in a lineage must stop
   * counting toward previous-question history.
   */
  async clearForPapers(
    organizationId: string,
    paperIds: readonly (string | Types.ObjectId)[],
  ): Promise<number> {
    if (paperIds.length === 0) return 0;
    const removed = await questionUsageRepository.deleteForPapers(organizationId, paperIds);
    if (removed > 0) {
      logger.info("Question usage cleared", {
        organizationId,
        papers: paperIds.length,
        removed,
      });
    }
    return removed;
  },
};

export type QuestionUsageService = typeof questionUsageService;
