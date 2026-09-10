import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { UserRole } from "@/types/roles";

/**
 * Two-stage per-paper semantic similarity: cosine CANDIDATE detection (>= 0.90)
 * then Gemini semantic validation (final decision). Both Gemini calls
 * (`embedTexts`, `validateSimilarity`) and `paperGeneratorService.generate` are
 * stubbed — nothing hits the network.
 *
 * Embedding stub encodes a target cosine in the question text:
 *   [[ANG:d]]  -> a 2-D unit vector at d degrees  (cos of the angle difference)
 *   [[SIM:k]]  -> the basis vector e_(k+2)         (cos 1 for same k, 0 otherwise)
 */

const harness = await startDatabase();
const available = harness !== null;
const DIMS = 128;

afterAll(async () => {
  await harness?.stop();
});
beforeEach(async () => {
  if (available) await clearCollections();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function actorFor(id: Types.ObjectId, role: UserRole, organizationId: string): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: `${role}-${id.toString()}@example.com`,
    name: role,
    role,
    status: "active",
    organizationId,
  };
}
const audit: AuditContext = { actor: null, requestId: "test", ip: "127.0.0.1" };

function tagVector(text: string): number[] {
  const ang = /\[\[ANG:(-?\d+(?:\.\d+)?)\]\]/.exec(text);
  if (ang) {
    const r = (Number(ang[1]) * Math.PI) / 180;
    const v = new Array(DIMS).fill(0);
    v[0] = Math.cos(r);
    v[1] = Math.sin(r);
    return v;
  }
  const m = /\[\[SIM:(\d+)\]\]/.exec(text);
  const k = (m ? Number(m[1]) % (DIMS - 2) : 0) + 2;
  const v = new Array(DIMS).fill(0);
  v[k] = 1;
  return v;
}

async function stubEmbeddings() {
  const { geminiClient } = await import("@/lib/ai/gemini");
  vi.spyOn(geminiClient, "embedTexts").mockImplementation(async (texts: string[]) =>
    texts.map(tagVector),
  );
  vi.spyOn(geminiClient, "embeddingModel", "get").mockReturnValue("stub-embed");
}

type ValidatePairs = { a: string; b: string }[];
type Verdict = { isSimilar: boolean; confidence: number; reason: string };

async function stubValidation(impl: (pairs: ValidatePairs) => Verdict[]) {
  const { geminiClient } = await import("@/lib/ai/gemini");
  return vi
    .spyOn(geminiClient, "validateSimilarity")
    .mockImplementation(async (pairs: ValidatePairs) => impl(pairs));
}
const allSimilar = (pairs: ValidatePairs): Verdict[] =>
  pairs.map(() => ({ isSimilar: true, confidence: 95, reason: "stub-similar" }));
const noneSimilar = (pairs: ValidatePairs): Verdict[] =>
  pairs.map(() => ({ isSimilar: false, confidence: 97, reason: "stub-different" }));

async function spyValidationNeverCalled() {
  const { geminiClient } = await import("@/lib/ai/gemini");
  return vi.spyOn(geminiClient, "validateSimilarity").mockResolvedValue([]);
}

interface Fx {
  org: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  teacher: Types.ObjectId;
  actor: AuthContext;
}

async function seed(slug: string): Promise<Fx> {
  const { Organization, OrganizationMember, Category, Subject, Chapter, User } = await import("@/models");
  const org = await Organization.create({ name: slug, slug });
  const category = await Category.create({ organizationId: org._id, name: `${slug} c`, slug: `${slug}-c` });
  const subject = await Subject.create({
    organizationId: org._id,
    name: `${slug} s`,
    slug: `${slug}-s`,
    category: category._id,
  });
  const chapter = await Chapter.create({
    organizationId: org._id,
    name: `${slug} ch`,
    slug: `${slug}-ch`,
    category: category._id,
    subject: subject._id,
  });
  const teacher = await User.create({
    name: `${slug} t`,
    email: `${slug}-t@example.com`,
    password: "x",
    role: "teacher",
    organization: org._id,
  });
  await OrganizationMember.create({
    userId: teacher._id,
    organizationId: org._id,
    role: "teacher",
    status: "active",
  });
  return {
    org: org._id,
    category: category._id,
    subject: subject._id,
    chapter: chapter._id,
    teacher: teacher._id,
    actor: actorFor(teacher._id, "teacher", org._id.toString()),
  };
}

let counter = 0;
async function makeMarkedQuestion(fx: Fx, marker: string): Promise<string> {
  const { Question } = await import("@/models");
  const { questionContentHash } = await import("@/lib/security/hash");
  counter += 1;
  const text = `Question number ${counter} about topic [[${marker}]]`;
  const q = await Question.create({
    organizationId: fx.org,
    category: fx.category,
    subject: fx.subject,
    chapter: fx.chapter,
    type: "MCQ",
    difficulty: "EASY",
    language: "en",
    question: { text },
    options: [
      { id: "A", text: "alpha" },
      { id: "B", text: "beta" },
    ],
    answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
    contentHash: questionContentHash(fx.chapter.toString(), text),
    marks: 1,
    status: "APPROVED",
    isActive: true,
    createdBy: fx.teacher,
  });
  return q._id.toString();
}
const makeQuestion = (fx: Fx, tag: number) => makeMarkedQuestion(fx, `SIM:${tag}`);
const makeAngleQuestion = (fx: Fx, deg: number) => makeMarkedQuestion(fx, `ANG:${deg}`);

async function makePaper(fx: Fx, questionIds: string[]): Promise<string> {
  const { QuestionPaper } = await import("@/models");
  const paper = await QuestionPaper.create({
    organizationId: fx.org,
    title: "Similarity Paper",
    category: fx.category,
    subject: fx.subject,
    mode: "MANUAL",
    status: "DRAFT",
    totalQuestions: questionIds.length,
    totalMarks: questionIds.length,
    sections: [
      {
        title: "",
        instructions: "",
        order: 0,
        questions: questionIds.map((id, i) => ({
          question: new Types.ObjectId(id),
          order: i,
          marks: 1,
          note: "",
        })),
      },
    ],
    createdBy: fx.teacher,
    isActive: true,
  });
  return paper._id.toString();
}

function stubGenerator(sequence: { id: string }[]) {
  return import("@/lib/services/paper-generator.service").then(({ paperGeneratorService }) => {
    let call = 0;
    vi.spyOn(paperGeneratorService, "generate").mockImplementation(async () => {
      const next = sequence[call] ?? sequence[sequence.length - 1];
      call += 1;
      return { questions: next ? [{ id: next.id }] : [] } as unknown as Awaited<
        ReturnType<typeof paperGeneratorService.generate>
      >;
    });
  });
}

describe.skipIf(!available)("paper semantic similarity (two-stage)", () => {
  it("A — 87% related pair: below 0.90, no Gemini validation, not flagged", async () => {
    await stubEmbeddings();
    const spy = await spyValidationNeverCalled();
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("relA");
    const paperId = await makePaper(fx, [
      await makeAngleQuestion(fx, 0),
      await makeAngleQuestion(fx, 30), // cos ≈ 0.866
    ]);

    const review = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(review.pairs).toHaveLength(0);
    expect(review.thresholdPercent).toBe(90);
    expect(spy).not.toHaveBeenCalled();
  });

  it("B — 93% same concept: candidate + Gemini says true → flagged, cosine score shown", async () => {
    await stubEmbeddings();
    await stubValidation(allSimilar);
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("sameB");
    const paperId = await makePaper(fx, [
      await makeAngleQuestion(fx, 0),
      await makeAngleQuestion(fx, 21), // cos ≈ 0.934
    ]);

    const review = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(review.pairs).toHaveLength(1);
    expect(review.pairs[0]!.scorePercent).toBe(93); // cosine, not Gemini confidence
  });

  it("C — 92% related but different concepts: candidate sent, Gemini says false → not flagged", async () => {
    await stubEmbeddings();
    const spy = await stubValidation(noneSimilar);
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("diffC");
    const paperId = await makePaper(fx, [
      await makeAngleQuestion(fx, 0),
      await makeAngleQuestion(fx, 23), // cos ≈ 0.920
    ]);

    const review = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(review.pairs).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(1); // validation WAS attempted for the candidate
  });

  it("D — 95% reworded duplicate: candidate + Gemini true → flagged", async () => {
    await stubEmbeddings();
    await stubValidation(allSimilar);
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("dupD");
    const paperId = await makePaper(fx, [
      await makeAngleQuestion(fx, 0),
      await makeAngleQuestion(fx, 18), // cos ≈ 0.951
    ]);

    const review = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(review.pairs).toHaveLength(1);
    expect(review.pairs[0]!.scorePercent).toBe(95);
  });

  it("E — multiple pairs: only the >= 0.90 candidates are sent to Gemini (one batched call)", async () => {
    await stubEmbeddings();
    let received: ValidatePairs = [];
    const spy = await stubValidation((pairs) => {
      received = pairs;
      return noneSimilar(pairs);
    });
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("multiE");
    // (0,20)=0.94✓  (20,40)=0.94✓  (0,40)=0.77✗  everything with 88 ✗
    const paperId = await makePaper(fx, [
      await makeAngleQuestion(fx, 0),
      await makeAngleQuestion(fx, 20),
      await makeAngleQuestion(fx, 40),
      await makeAngleQuestion(fx, 88),
    ]);

    await paperSimilarityService.getReview(paperId, fx.actor);
    expect(spy).toHaveBeenCalledTimes(1); // ONE batched call, not one per pair
    expect(received).toHaveLength(2); // only the two >= 0.90 candidates
  });

  it("F — no candidate pairs: zero Gemini validation calls", async () => {
    await stubEmbeddings();
    const spy = await spyValidationNeverCalled();
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("noneF");
    const ids = await Promise.all([1, 2, 3, 4, 5].map((t) => makeQuestion(fx, t)));
    const paperId = await makePaper(fx, ids);

    const review = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(review.questionCount).toBe(5);
    expect(review.pairs).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns only the flagged pairs among many, each once, never reversed", async () => {
    await stubEmbeddings();
    await stubValidation(allSimilar);
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const fx = await seed("multi");
    const tags = Array.from({ length: 25 }, (_, i) => i + 1);
    tags[4] = 99; // Q5
    tags[17] = 99; // Q18  -> pair
    tags[9] = 88; // Q10
    tags[21] = 88; // Q22  -> pair
    const ids = [];
    for (const t of tags) ids.push(await makeQuestion(fx, t));
    const paperId = await makePaper(fx, ids);

    const review = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(review.pairs).toHaveLength(2);
    const asKeys = review.pairs.map((p) => [p.a.number, p.b.number].sort((x, y) => x - y).join("-"));
    expect(new Set(asKeys)).toEqual(new Set(["5-18", "10-22"]));
    expect(review.pairs.every((p) => p.a.number < p.b.number)).toBe(true);
    expect(new Set(asKeys).size).toBe(review.pairs.length);
  });

  it("G — Keep Both hides the pair, persists, skips re-validation, never edits questions", async () => {
    await stubEmbeddings();
    const spy = await stubValidation(allSimilar);
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const { Question } = await import("@/models");
    const fx = await seed("keep");
    const ids = await Promise.all([5, 5].map((t) => makeQuestion(fx, t)));
    const paperId = await makePaper(fx, ids);
    const before = await Question.findById(ids[0]).lean();

    const afterKeep = await paperSimilarityService.keepBoth(
      paperId,
      { questionAId: ids[0]!, questionBId: ids[1]! },
      fx.actor,
      audit,
    );
    expect(afterKeep.pairs).toHaveLength(0);
    const callsAfterKeep = spy.mock.calls.length;

    const reloaded = await paperSimilarityService.getReview(paperId, fx.actor);
    expect(reloaded.pairs).toHaveLength(0);
    // Resolved pairs are filtered BEFORE Gemini — no extra validation call.
    expect(spy.mock.calls.length).toBe(callsAfterKeep);

    const now = await Question.findById(ids[0]).lean();
    expect(now!.question.text).toBe(before!.question.text);
    expect(now!.contentHash).toBe(before!.contentHash);
    expect(now!.isActive).toBe(true);
  });

  it("H — Replace: a >=0.90 candidate that Gemini clears is accepted; the count is preserved", async () => {
    await stubEmbeddings();
    // spareA is cosine-1 with q1 (a candidate) but Gemini says it is NOT similar.
    await stubValidation(noneSimilar);
    const fx = await seed("replH");
    const q1 = await makeQuestion(fx, 5);
    const q2 = await makeQuestion(fx, 5); // flagged with q1
    const paperId = await makePaper(fx, [q1, q2]);
    const spareA = await makeQuestion(fx, 5); // cosine candidate vs q1
    await stubGenerator([{ id: spareA }]);

    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const { QuestionPaper } = await import("@/models");

    const result = await paperSimilarityService.replaceQuestion(paperId, { questionId: q2 }, fx.actor, audit);
    expect(result.accepted).toBe(true);
    expect(result.replaced!.newId).toBe(spareA);

    const paper = await QuestionPaper.findById(paperId).lean();
    const finalIds = paper!.sections.flatMap((s) => s.questions.map((x) => x.question.toString()));
    expect(finalIds).toHaveLength(2);
    expect(finalIds).toContain(q1);
    expect(finalIds).toContain(spareA);
    expect(finalIds).not.toContain(q2);
  });

  it("Replace: rejects Gemini-confirmed similar candidates, accepts a clearly different one", async () => {
    await stubEmbeddings();
    // Gemini confirms every candidate it is asked about as similar.
    await stubValidation(allSimilar);
    const fx = await seed("repl");
    const q1 = await makeQuestion(fx, 5);
    const q2 = await makeQuestion(fx, 5);
    const paperId = await makePaper(fx, [q1, q2]);
    const spareA = await makeQuestion(fx, 5); // candidate → rejected
    const spareB = await makeQuestion(fx, 5); // candidate → rejected
    const spareC = await makeQuestion(fx, 7); // cosine 0 → no Gemini call → accepted
    await stubGenerator([{ id: spareA }, { id: spareB }, { id: spareC }]);

    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const { QuestionPaper } = await import("@/models");

    const result = await paperSimilarityService.replaceQuestion(paperId, { questionId: q2 }, fx.actor, audit);
    expect(result.accepted).toBe(true);
    expect(result.replaced!.newId).toBe(spareC);
    expect(result.attempts).toHaveLength(3);
    expect(result.review.pairs).toHaveLength(0);

    const paper = await QuestionPaper.findById(paperId).lean();
    const finalIds = paper!.sections.flatMap((s) => s.questions.map((x) => x.question.toString()));
    expect(finalIds).toHaveLength(2);
    expect(finalIds).not.toContain(q2);
  });

  it("Replace: gives up after 3 Gemini-confirmed-similar attempts without touching the paper", async () => {
    await stubEmbeddings();
    await stubValidation(allSimilar);
    const fx = await seed("fail");
    const q1 = await makeQuestion(fx, 5);
    const q2 = await makeQuestion(fx, 5);
    const paperId = await makePaper(fx, [q1, q2]);
    const spares = await Promise.all([5, 5, 5].map((t) => makeQuestion(fx, t)));
    await stubGenerator(spares.map((id) => ({ id })));

    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const { QuestionPaper } = await import("@/models");

    const result = await paperSimilarityService.replaceQuestion(paperId, { questionId: q2 }, fx.actor, audit);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("all_attempts_similar");
    expect(result.attempts).toHaveLength(3);

    const paper = await QuestionPaper.findById(paperId).lean();
    const finalIds = paper!.sections.flatMap((s) => s.questions.map((x) => x.question.toString()));
    expect(finalIds).toEqual([q1, q2]);
  });

  it("Replace: reports gracefully when the generator finds no candidate", async () => {
    await stubEmbeddings();
    await spyValidationNeverCalled();
    const fx = await seed("nocand");
    const q1 = await makeQuestion(fx, 5);
    const q2 = await makeQuestion(fx, 5);
    const paperId = await makePaper(fx, [q1, q2]);

    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const { ValidationError } = await import("@/lib/errors/app-error");
    vi.spyOn(paperGeneratorService, "generate").mockRejectedValue(
      new ValidationError("No approved questions match the selected chapters and filters."),
    );

    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const result = await paperSimilarityService.replaceQuestion(paperId, { questionId: q2 }, fx.actor, audit);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("no_candidates");
    expect(result.attempts).toHaveLength(0);
  });

  it("I — organization isolation across every endpoint", async () => {
    await stubEmbeddings();
    await spyValidationNeverCalled();
    const { paperSimilarityService } = await import("@/lib/services/paper-similarity.service");
    const { NotFoundError } = await import("@/lib/errors/app-error");

    const orgA = await seed("orgA");
    const ids = await Promise.all([5, 5].map((t) => makeQuestion(orgA, t)));
    const paperId = await makePaper(orgA, ids);

    const orgB = await seed("orgB");
    const intruder = actorFor(orgB.teacher, "moderator", orgB.org.toString());

    await expect(paperSimilarityService.getReview(paperId, intruder)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      paperSimilarityService.keepBoth(paperId, { questionAId: ids[0]!, questionBId: ids[1]! }, intruder, audit),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      paperSimilarityService.replaceQuestion(paperId, { questionId: ids[0]! }, intruder, audit),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
