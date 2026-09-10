import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import type { AuthContext } from "@/lib/auth/session";
import { requireContentOrganizationId } from "@/lib/auth/org-session";
import { canActOnResource } from "@/lib/auth/rbac";
import { sha256 } from "@/lib/security/hash";
import { geminiClient } from "@/lib/ai/gemini";
import { questionRepository } from "@/lib/repositories/question.repo";
import { questionEmbeddingRepository } from "@/lib/repositories/question-embedding.repo";
import { paperSimilarityRepository } from "@/lib/repositories/paper-similarity.repo";
import { paperGeneratorService } from "@/lib/services/paper-generator.service";
import { paperService } from "@/lib/services/paper.service";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { logger } from "@/lib/logger";
import {
  MAX_REPLACEMENT_ATTEMPTS,
  SIMILARITY_CANDIDATE_THRESHOLD,
  SIMILARITY_CANDIDATE_THRESHOLD_PERCENT,
  toPercent,
} from "@/lib/similarity/config";
import { cosineSimilarity, pairwiseAboveThreshold } from "@/lib/similarity/cosine";
import type { SimilarityCandidatePair } from "@/lib/similarity/validation-prompt";
import { OPTION_BASED_TYPES } from "@/types/question";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";
import type { KeepBothInput, ReplaceQuestionInput } from "@/lib/validation/paper-similarity.schema";

/**
 * Per-paper semantic similarity check + review workflow.
 *
 * Scope is ALWAYS the current paper's own questions — N*(N-1)/2 unique pairs,
 * never the question bank. Two stages:
 *   1. cosine similarity (local) over cached Gemini embeddings — a CANDIDATE
 *      detector. A pair below `SIMILARITY_CANDIDATE_THRESHOLD` (0.90) is dropped
 *      here and never reaches Gemini or the review.
 *   2. Gemini semantic validation of the (few) candidates in ONE batched call —
 *      the FINAL decision. A pair is flagged only when cosine >= 0.90 AND Gemini
 *      says `isSimilar`.
 * The displayed "% Similar" is always the cosine score. `contentHash`
 * exact-duplicate detection and the Gemini generation flow are untouched.
 *
 * Org isolation: the paper is always loaded through `paperService.getById`
 * (which resolves the tenant from the session and 404s a foreign paper) and
 * every embedding / review query is organization-scoped.
 */

/* ------------------------------ shapes ------------------------------ */

export interface SimilarityQuestionView {
  questionId: string;
  number: number;
  text: string;
  type: string;
  difficulty: string | null;
}

export interface SimilarityPairView {
  a: SimilarityQuestionView;
  b: SimilarityQuestionView;
  score: number;
  scorePercent: number;
}

export interface SimilarityReviewResult {
  paperId: string;
  questionCount: number;
  threshold: number;
  thresholdPercent: number;
  model: string;
  generatedAt: string;
  pairs: SimilarityPairView[];
  /** Set when the paper has fewer than two questions. */
  note?: string;
}

export interface ReplaceResult {
  accepted: boolean;
  reason?: "no_candidates" | "all_attempts_similar";
  replaced?: { oldId: string; newId: string; score: number; scorePercent: number };
  /** One entry per candidate that was generated and scored. */
  attempts: { scorePercent: number }[];
  review: SimilarityReviewResult;
}

type EmbeddingSource = Awaited<
  ReturnType<typeof questionRepository.findEmbeddingSource>
>[number];

/* ------------------------------ helpers ------------------------------ */

const idOf = (value: unknown): string =>
  value && typeof value === "object" && "_id" in value
    ? String((value as { _id: unknown })._id)
    : String(value ?? "");

/** The exact text embedded for a question: stem + passage + (option-based) options. */
function buildEmbeddingText(source: EmbeddingSource | undefined): string {
  if (!source) return "";
  const parts: string[] = [source.question?.text ?? ""];
  if (source.question?.passage) parts.push(source.question.passage);
  if (
    (OPTION_BASED_TYPES as readonly string[]).includes(source.type) &&
    Array.isArray(source.options)
  ) {
    const options = source.options.map((o) => o.text).filter(Boolean).join(" | ");
    if (options) parts.push(options);
  }
  return parts.filter(Boolean).join("\n").slice(0, 8000);
}

interface EnsuredEmbeddings {
  sources: Map<string, EmbeddingSource>;
  vectors: Map<string, number[]>;
}

/**
 * Returns an embedding vector for every id — from the cache when the cached
 * `sourceHash` and `model` still match, otherwise freshly embedded (one batch
 * call) and written back to the cache.
 */
async function ensureEmbeddings(
  ids: readonly string[],
  organizationId: string,
): Promise<EnsuredEmbeddings> {
  const uniqueIds = [...new Set(ids)];
  const sourceRows = await questionRepository.findEmbeddingSource(uniqueIds, organizationId);
  const sources = new Map(sourceRows.map((row) => [row._id.toString(), row]));

  const model = geminiClient.embeddingModel;
  const inputs = new Map<string, string>();
  const hashes = new Map<string, string>();
  for (const id of uniqueIds) {
    const text = buildEmbeddingText(sources.get(id));
    inputs.set(id, text);
    hashes.set(id, sha256(`${model}::${text}`));
  }

  const cached = await questionEmbeddingRepository.findByQuestionIds(uniqueIds, organizationId);
  const vectors = new Map<string, number[]>();
  const missIds: string[] = [];
  for (const id of uniqueIds) {
    const row = cached.get(id);
    // A cache hit requires BOTH the same embedding model and the same source
    // text. Vectors from a different model (e.g. the retired text-embedding-004)
    // are never mixed with gemini-embedding-001 — the row is treated as a miss
    // and overwritten on `upsertMany` below.
    if (row && row.model === model && row.sourceHash === hashes.get(id)) {
      vectors.set(id, row.vector);
    } else {
      missIds.push(id);
    }
  }

  if (missIds.length > 0) {
    const fresh = await geminiClient.embedTexts(missIds.map((id) => inputs.get(id) ?? ""));
    const upserts = missIds.map((id, index) => {
      const vector = fresh[index] ?? [];
      vectors.set(id, vector);
      return {
        organizationId,
        questionId: id,
        sourceHash: hashes.get(id) ?? "",
        model,
        vector,
      };
    });
    await questionEmbeddingRepository.upsertMany(upserts);
  }

  return { sources, vectors };
}

/** Ordered `{ id, number }` for every question the paper contains. */
function orderedQuestions(paper: {
  sections: { questions: { question: unknown }[] }[];
}): { id: string; number: number }[] {
  const out: { id: string; number: number }[] = [];
  let n = 0;
  for (const section of paper.sections) {
    for (const entry of section.questions) {
      n += 1;
      out.push({ id: idOf(entry.question), number: n });
    }
  }
  return out;
}

const pairKeyFor = (hashA: string, hashB: string): string => [hashA, hashB].sort().join(":");

/**
 * The core check, two-stage:
 *  1. cosine over cached embeddings → candidate pairs `>= SIMILARITY_CANDIDATE_THRESHOLD`,
 *     minus any the teacher already resolved with "Keep Both";
 *  2. ONE batched Gemini semantic validation of those candidates → keep only the
 *     pairs Gemini confirms are genuinely the same question.
 * The `score` shown to the user is always the stage-1 cosine value.
 */
async function computeReview(
  paperId: string,
  actor: AuthContext,
  organizationId: string,
  context?: AuditContext,
): Promise<SimilarityReviewResult> {
  const paper = await paperService.getById(paperId, actor);

  const questions = orderedQuestions(paper);
  const model = geminiClient.embeddingModel;
  const base = {
    paperId,
    questionCount: questions.length,
    threshold: SIMILARITY_CANDIDATE_THRESHOLD,
    thresholdPercent: SIMILARITY_CANDIDATE_THRESHOLD_PERCENT,
    model,
    generatedAt: new Date().toISOString(),
  };

  if (questions.length < 2) {
    return { ...base, pairs: [], note: "A paper needs at least two questions to check for similarity." };
  }

  const ids = questions.map((q) => q.id);
  const { sources, vectors } = await ensureEmbeddings(ids, organizationId);

  const orderedVectors = ids.map((id) => vectors.get(id) ?? []);
  const hashOf = (id: string) => sources.get(id)?.contentHash ?? id;

  const review = await paperSimilarityRepository.findByPaperId(paperId, organizationId);
  const resolved = new Set((review?.resolvedPairs ?? []).map((p) => p.pairKey));

  // Stage 1 — local cosine candidate detection (never the whole bank).
  const candidates = pairwiseAboveThreshold(orderedVectors, SIMILARITY_CANDIDATE_THRESHOLD).filter(
    (p) => !resolved.has(pairKeyFor(hashOf(ids[p.i]!), hashOf(ids[p.j]!))),
  );

  // Stage 2 — Gemini decides. One batched call; skipped entirely when there are
  // no candidates (a 25-question paper with no near-duplicates makes 0 Gemini calls).
  const verdicts =
    candidates.length > 0
      ? await geminiClient.validateSimilarity(
          candidates.map<SimilarityCandidatePair>((p) => ({
            a: buildEmbeddingText(sources.get(ids[p.i]!)),
            b: buildEmbeddingText(sources.get(ids[p.j]!)),
          })),
        )
      : [];

  const pairs: SimilarityPairView[] = candidates
    .filter((_p, k) => verdicts[k]?.isSimilar === true)
    .map((p) => {
      const qa = questions[p.i]!;
      const qb = questions[p.j]!;
      const sa = sources.get(qa.id);
      const sb = sources.get(qb.id);
      return {
        a: {
          questionId: qa.id,
          number: qa.number,
          text: sa?.question?.text ?? "",
          type: sa?.type ?? "",
          difficulty: sa?.difficulty ?? null,
        },
        b: {
          questionId: qb.id,
          number: qb.number,
          text: sb?.question?.text ?? "",
          type: sb?.type ?? "",
          difficulty: sb?.difficulty ?? null,
        },
        // Always the cosine score — never Gemini's confidence.
        score: p.score,
        scorePercent: toPercent(p.score),
      };
    });

  const signature = sha256(ids.map((id) => `${id}:${hashOf(id)}`).join("|"));
  await paperSimilarityRepository.upsertMeta(paperId, organizationId, {
    threshold: SIMILARITY_CANDIDATE_THRESHOLD,
    model,
    signature,
    lastQuestionCount: questions.length,
    lastFlaggedCount: pairs.length,
    lastCheckedBy: actor.objectId,
    lastCheckedAt: new Date(),
  });

  if (context) {
    await auditService.record(
      {
        action: "paper.similarity-check",
        resourceType: "paper",
        resourceId: paperId,
        metadata: {
          questions: questions.length,
          candidates: candidates.length,
          flagged: pairs.length,
        },
      },
      context,
    );
  }

  return { ...base, pairs };
}

/** Build the 1-question generation spec for a replacement. */
function buildReplacementSpec(
  paper: { category: unknown; subject: unknown; generationSpec: unknown },
  removed: EmbeddingSource,
): GeneratePaperInput {
  const gs = (paper.generationSpec ?? {}) as Record<string, unknown>;
  const chapterId = idOf(removed.chapter);
  const topicId = removed.topic ? idOf(removed.topic) : null;

  return {
    organizationId: null,
    category: idOf(paper.category),
    subject: idOf(paper.subject),
    chapters: [chapterId],
    topics: topicId ? [topicId] : [],
    board: gs.board ? idOf(gs.board) : null,
    exam: gs.exam ? idOf(gs.exam) : null,
    year: (gs.year as number | null | undefined) ?? null,
    language: removed.language ?? (gs.language as GeneratePaperInput["language"]) ?? null,
    totalQuestions: 1,
    totalMarks: null,
    difficultyDistribution: removed.difficulty ? [{ difficulty: removed.difficulty, count: 1 }] : [],
    typeDistribution: [{ type: removed.type, count: 1 }],
    chapterDistribution: [],
    previousQuestions: { mode: "allow", percent: 100, paperRange: 0 },
    excludeRecentPapers: 0,
    mandatoryQuestionIds: [],
    excludedQuestionIds: [],
    randomize: { selection: true, order: false, options: false },
    status: "APPROVED",
  };
}

/* ------------------------------ service ------------------------------ */

export const paperSimilarityService = {
  /** Read-only view of the current flagged pairs (used by GET and the button). */
  async getReview(
    paperId: string,
    actor: AuthContext,
    context?: AuditContext,
  ): Promise<SimilarityReviewResult> {
    const organizationId = await requireContentOrganizationId(actor);
    return computeReview(paperId, actor, organizationId, context);
  },

  /**
   * "Keep Both" — the teacher decided the two questions are actually different.
   * Records the decision (so the pair stays dismissed) and touches nothing else.
   */
  async keepBoth(
    paperId: string,
    input: KeepBothInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<SimilarityReviewResult> {
    const organizationId = await requireContentOrganizationId(actor);
    const paper = await paperService.getById(paperId, actor);
    if (!canActOnResource(actor.role, "update", actor.id, paper.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only review papers you created.");
    }

    const paperQuestionIds = new Set(orderedQuestions(paper).map((q) => q.id));
    if (!paperQuestionIds.has(input.questionAId) || !paperQuestionIds.has(input.questionBId)) {
      throw new NotFoundError("Question in this paper");
    }

    const sources = await questionRepository.findEmbeddingSource(
      [input.questionAId, input.questionBId],
      organizationId,
    );
    const hashById = new Map(sources.map((s) => [s._id.toString(), s.contentHash]));
    const pairKey = pairKeyFor(
      hashById.get(input.questionAId) ?? input.questionAId,
      hashById.get(input.questionBId) ?? input.questionBId,
    );

    await paperSimilarityRepository.addResolvedPair(paperId, organizationId, pairKey, actor.objectId);
    await auditService.record(
      {
        action: "paper.similarity-keep",
        resourceType: "paper",
        resourceId: paperId,
        metadata: { a: input.questionAId, b: input.questionBId },
      },
      context,
    );

    return computeReview(paperId, actor, organizationId);
  },

  /**
   * "Remove & Replace" — generate a replacement via the existing paper
   * generator, semantically validate it against the remaining questions, retry
   * up to `MAX_REPLACEMENT_ATTEMPTS`, and only then swap it in. On failure the
   * paper is left completely unchanged.
   */
  async replaceQuestion(
    paperId: string,
    input: ReplaceQuestionInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<ReplaceResult> {
    const organizationId = await requireContentOrganizationId(actor);
    const paper = await paperService.getById(paperId, actor);
    if (!canActOnResource(actor.role, "update", actor.id, paper.createdBy.toString(), "paper")) {
      throw new ForbiddenError("You may only edit papers you created.");
    }
    if (paper.status === "ARCHIVED") {
      throw new ConflictError("Restore this paper before editing it.");
    }

    const removeId = input.questionId;
    const paperQuestionIds = orderedQuestions(paper).map((q) => q.id);
    if (!paperQuestionIds.includes(removeId)) {
      throw new NotFoundError("Question in this paper");
    }

    const [removed] = await questionRepository.findEmbeddingSource([removeId], organizationId);
    if (!removed) throw new NotFoundError("Question");

    const remainingIds = paperQuestionIds.filter((id) => id !== removeId);
    const { sources: remainingSources, vectors: remainingVectors } = await ensureEmbeddings(
      remainingIds,
      organizationId,
    );

    const spec = buildReplacementSpec(paper, removed);

    const tried: string[] = [];
    const attempts: { questionId: string; score: number }[] = [];

    for (let attempt = 1; attempt <= MAX_REPLACEMENT_ATTEMPTS; attempt += 1) {
      let candidateId: string;
      try {
        const generated = await paperGeneratorService.generate(
          { ...spec, totalQuestions: 1, excludedQuestionIds: [...paperQuestionIds, ...tried] },
          organizationId,
        );
        if (generated.questions.length === 0) break;
        candidateId = generated.questions[0]!.id;
      } catch (error) {
        // Not enough eligible questions for the constraints — nothing to retry.
        if (error instanceof ValidationError) break;
        throw error;
      }

      if (paperQuestionIds.includes(candidateId) || tried.includes(candidateId)) {
        tried.push(candidateId);
        continue;
      }

      const { sources: candSources, vectors: candVectors } = await ensureEmbeddings(
        [candidateId],
        organizationId,
      );
      const candVector = candVectors.get(candidateId) ?? [];

      // Stage 1: which remaining questions is the candidate a cosine candidate against?
      let score = 0;
      const conflicts: string[] = [];
      for (const id of remainingIds) {
        const s = cosineSimilarity(candVector, remainingVectors.get(id) ?? []);
        if (s > score) score = s;
        if (s >= SIMILARITY_CANDIDATE_THRESHOLD) conflicts.push(id);
      }
      attempts.push({ questionId: candidateId, score });
      tried.push(candidateId);

      // Stage 2: a candidate is only "too similar" if Gemini confirms it for at
      // least one conflicting question. No conflicts => accept without a Gemini call.
      const candText = buildEmbeddingText(candSources.get(candidateId));
      const verdicts =
        conflicts.length > 0
          ? await geminiClient.validateSimilarity(
              conflicts.map<SimilarityCandidatePair>((id) => ({
                a: candText,
                b: buildEmbeddingText(remainingSources.get(id)),
              })),
            )
          : [];
      const tooSimilar = verdicts.some((v) => v.isSimilar === true);

      if (!tooSimilar) {
        await paperService.swapQuestion(paperId, removeId, candidateId, actor, context);
        logger.info("Similarity replacement accepted", {
          paperId,
          removed: removeId,
          added: candidateId,
          attempt,
          scorePercent: toPercent(score),
        });
        const review = await computeReview(paperId, actor, organizationId);
        return {
          accepted: true,
          replaced: { oldId: removeId, newId: candidateId, score, scorePercent: toPercent(score) },
          attempts: attempts.map((a) => ({ scorePercent: toPercent(a.score) })),
          review,
        };
      }
    }

    // Exhausted every attempt (or ran out of candidates) — paper untouched.
    const review = await computeReview(paperId, actor, organizationId);
    return {
      accepted: false,
      reason: attempts.length === 0 ? "no_candidates" : "all_attempts_similar",
      attempts: attempts.map((a) => ({ scorePercent: toPercent(a.score) })),
      review,
    };
  },
};

export type PaperSimilarityService = typeof paperSimilarityService;
