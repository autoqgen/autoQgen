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
};

export type QuestionUsageService = typeof questionUsageService;
