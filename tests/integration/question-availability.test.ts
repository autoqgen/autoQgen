import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

/**
 * `questionService.availability` powers the New Paper builder's live counts.
 * It must be organization-scoped (never leak another tenant's bank) and count
 * only APPROVED, active questions — the same eligibility the generator applies.
 */

const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, role: UserRole, organizationId: string | null): AuthContext {
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

interface Seeded {
  orgId: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapterA: Types.ObjectId;
  chapterB: Types.ObjectId;
  userId: Types.ObjectId;
}

async function seedOrg(slug: string): Promise<Seeded> {
  const { Organization, OrganizationMember, Category, Subject, Chapter, User } = await import("@/models");

  const org = await Organization.create({ name: `${slug} Org`, slug, isActive: true });
  const category = await Category.create({ organizationId: org._id, name: `${slug} Cat`, slug: `${slug}-cat` });
  const subject = await Subject.create({
    organizationId: org._id,
    name: `${slug} Sub`,
    slug: `${slug}-sub`,
    category: category._id,
  });
  const chapterA = await Chapter.create({
    organizationId: org._id,
    name: `${slug} Chapter A`,
    slug: `${slug}-chap-a`,
    category: category._id,
    subject: subject._id,
  });
  const chapterB = await Chapter.create({
    organizationId: org._id,
    name: `${slug} Chapter B`,
    slug: `${slug}-chap-b`,
    category: category._id,
    subject: subject._id,
  });
  const user = await User.create({
    name: `${slug} Teacher`,
    email: `${slug}-teacher@example.com`,
    password: "x",
    role: "teacher",
    organization: org._id,
  });
  await OrganizationMember.create({ userId: user._id, organizationId: org._id, role: "teacher", status: "active" });

  return { orgId: org._id, category: category._id, subject: subject._id, chapterA: chapterA._id, chapterB: chapterB._id, userId: user._id };
}

async function addQuestion(
  s: Seeded,
  chapter: Types.ObjectId,
  status: "APPROVED" | "DRAFT",
  text: string,
  isActive = true,
) {
  const { Question } = await import("@/models");
  const { questionContentHash } = await import("@/lib/security/hash");
  await Question.create({
    organizationId: s.orgId,
    category: s.category,
    subject: s.subject,
    chapter,
    type: "MCQ",
    language: "en",
    question: { text },
    options: [
      { id: "A", text: "x" },
      { id: "B", text: "y" },
    ],
    answer: { correctOptions: ["A"] },
    contentHash: questionContentHash(chapter.toString(), text),
    createdBy: s.userId,
    status,
    isActive,
  });
}

describe.skipIf(!available)("questionService.availability", () => {
  it("returns organization-scoped approved counts with a per-chapter breakdown", async () => {
    const { questionService } = await import("@/lib/services/question.service");

    const a = await seedOrg("alpha");
    const b = await seedOrg("beta");

    // Org A: 2 approved in chapter A, 1 approved in chapter B, 1 draft, 1 inactive.
    await addQuestion(a, a.chapterA, "APPROVED", "A-a-1");
    await addQuestion(a, a.chapterA, "APPROVED", "A-a-2");
    await addQuestion(a, a.chapterB, "APPROVED", "A-b-1");
    await addQuestion(a, a.chapterA, "DRAFT", "A-a-draft");
    await addQuestion(a, a.chapterB, "APPROVED", "A-b-inactive", false);

    // Org B: 5 approved — must never be counted for A.
    for (let i = 0; i < 5; i++) await addQuestion(b, b.chapterA, "APPROVED", `B-a-${i}`);

    const result = await questionService.availability(
      { category: a.category.toString(), subject: a.subject.toString() },
      actorFor(a.userId, "teacher", a.orgId.toString()),
    );

    expect(result.total).toBe(3); // approved + active only
    expect(result.chapters[a.chapterA.toString()]).toBe(2);
    expect(result.chapters[a.chapterB.toString()]).toBe(1);
    // Nothing from org B.
    expect(Object.keys(result.chapters)).not.toContain(b.chapterA.toString());
  });

  it("scopes the category total to the caller's organization", async () => {
    const { questionService } = await import("@/lib/services/question.service");

    const a = await seedOrg("alpha");
    const b = await seedOrg("beta");
    await addQuestion(a, a.chapterA, "APPROVED", "A-1");
    await addQuestion(a, a.chapterB, "APPROVED", "A-2");
    for (let i = 0; i < 9; i++) await addQuestion(b, b.chapterA, "APPROVED", `B-${i}`);

    const forA = await questionService.availability(
      { category: a.category.toString() },
      actorFor(a.userId, "teacher", a.orgId.toString()),
    );
    expect(forA.total).toBe(2);

    const forB = await questionService.availability(
      { category: b.category.toString() },
      actorFor(b.userId, "teacher", b.orgId.toString()),
    );
    expect(forB.total).toBe(9);
  });

  it("returns an empty result when the caller has no organization", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const a = await seedOrg("alpha");
    await addQuestion(a, a.chapterA, "APPROVED", "A-1");

    const result = await questionService.availability(
      { category: a.category.toString() },
      actorFor(new Types.ObjectId(), "teacher", null),
    );
    expect(result).toEqual({ total: 0, chapters: {} });
  });
});
