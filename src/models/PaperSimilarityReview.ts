import { Schema, Types, model, models, type Model } from "mongoose";

import { SIMILARITY_CANDIDATE_THRESHOLD } from "@/lib/similarity/config";

/**
 * Persisted review state for one paper's semantic-similarity check.
 *
 * The flagged pairs themselves are NOT stored — they are recomputed from the
 * (cached) embeddings on every check so the review page always reflects the
 * paper's latest state. This document only persists:
 *   - the teacher's "Keep Both" decisions, so a dismissed pair stays dismissed;
 *   - a `signature` of the paper's questions at last check, to tell whether the
 *     paper has changed since;
 *   - lightweight metadata for display.
 */

export const SIMILARITY_PAIR_DECISIONS = ["kept"] as const;
export type SimilarityPairDecision = (typeof SIMILARITY_PAIR_DECISIONS)[number];

export interface IResolvedSimilarityPair {
  /** `[contentHashA, contentHashB].sort().join(":")` — stable across reordering. */
  pairKey: string;
  decision: SimilarityPairDecision;
  resolvedBy: Types.ObjectId | null;
  resolvedAt: Date;
}

const ResolvedPairSchema = new Schema<IResolvedSimilarityPair>(
  {
    pairKey: { type: String, required: true, maxlength: 200 },
    decision: { type: String, enum: SIMILARITY_PAIR_DECISIONS, default: "kept" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export interface IPaperSimilarityReview {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  paperId: Types.ObjectId;
  threshold: number;
  model: string;
  /** sha256 of the paper's ordered "<questionId>:<contentHash>" list at last check. */
  signature: string;
  lastQuestionCount: number;
  lastFlaggedCount: number;
  lastCheckedBy: Types.ObjectId | null;
  lastCheckedAt: Date | null;
  resolvedPairs: IResolvedSimilarityPair[];
  createdAt: Date;
  updatedAt: Date;
}

const PaperSimilarityReviewSchema = new Schema<IPaperSimilarityReview>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    paperId: { type: Schema.Types.ObjectId, ref: "QuestionPaper", required: true },
    threshold: { type: Number, default: SIMILARITY_CANDIDATE_THRESHOLD },
    model: { type: String, default: "", maxlength: 120 },
    signature: { type: String, default: "", maxlength: 64 },
    lastQuestionCount: { type: Number, default: 0 },
    lastFlaggedCount: { type: Number, default: 0 },
    lastCheckedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastCheckedAt: { type: Date, default: null },
    resolvedPairs: { type: [ResolvedPairSchema], default: [] },
  },
  { timestamps: true },
);

// One review document per paper; scoped for tenant isolation.
PaperSimilarityReviewSchema.index({ organizationId: 1, paperId: 1 }, { unique: true });

export const PaperSimilarityReview: Model<IPaperSimilarityReview> =
  (models.PaperSimilarityReview as Model<IPaperSimilarityReview>) ??
  model<IPaperSimilarityReview>("PaperSimilarityReview", PaperSimilarityReviewSchema);

export default PaperSimilarityReview;
