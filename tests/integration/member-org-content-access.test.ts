import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { UserRole } from "@/types/roles";
import { questionListQuerySchema } from "@/lib/validation/question.schema";

/**
 * Resolved via top-level await, not inside beforeAll — see the identical
 * comment in organization-service.test.ts for why this matters.
 */
const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(
  id: Types.ObjectId,
  role: UserRole,
  email?: string,
  organizationId: string | null = null,
): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: email ?? `${role}-${id.toString()}@example.com`,
    name: role,
    role,
    status: "active",
    organizationId,
  };
}

function auditFor(): AuditContext {
  return { actor: null, requestId: "test", ip: "127.0.0.1" };
}

describe.skipIf(!available)("global 'member' + org membership -> question:read / paper:create", () => {
  async function seedTaxonomyAndQuestion() {
    const { Organization, Category, Subject, Chapter, User, Question } = await import("@/models");
    const { questionContentHash } = await import("@/lib/security/hash");

    // The content lives in one organization; tests decide per case whether the
    // acting user belongs to it.
    const org = await Organization.create({ name: "Content Org", slug: "content-org" });
    const category = await Category.create({ organizationId: org._id, name: "Class 9-10", slug: "class-9-10" });
    const subject = await Subject.create({ organizationId: org._id, name: "Physics", slug: "physics", category: category._id });
    const chapter = await Chapter.create({
      organizationId: org._id,
      name: "Force",
      slug: "force",
      category: category._id,
      subject: subject._id,
    });

    const creator = await User.create({
      name: "Creator",
      email: "creator@example.com",
      password: "x",
      role: "teacher",
      organization: org._id,
    });

    const text = "What is the SI unit of force?";
    const question = await Question.create({
      organizationId: org._id,
      category: category._id,
      subject: subject._id,
      chapter: chapter._id,
      type: "MCQ",
      difficulty: "EASY",
      question: { text },
      options: [
        { id: "A", text: "Newton" },
        { id: "B", text: "Joule" },
      ],
      answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
      contentHash: questionContentHash(chapter._id.toString(), text),
      marks: 1,
      status: "APPROVED",
      isActive: true,
      createdBy: creator._id,
    });

    return { org, category, subject, chapter, question };
  }

  function paperInput(seeded: Awaited<ReturnType<typeof seedTaxonomyAndQuestion>>, title: string) {
    return {
      organizationId: null,
      title,
      description: "",
      instructions: "",
      category: seeded.category._id.toString(),
      subject: seeded.subject._id.toString(),
      board: null,
      exam: null,
      year: null,
      durationMinutes: null,
      sections: [
        {
          title: "",
          instructions: "",
          order: 0,
          questions: [{ question: seeded.question._id.toString(), order: 0, note: "" }],
        },
      ],
    };
  }

  it("denies question:read (list and detail) to a new member with no organization", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { User } = await import("@/models");
    const seeded = await seedTaxonomyAndQuestion();

    const member = await User.create({ name: "New Member", email: "newmember@example.com", password: "x", role: "member" });
    const actor = actorFor(member._id, "member", "newmember@example.com");

    await expect(
      questionService.getById(seeded.question._id.toString(), actor, { requestAnswers: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      questionService.list(questionListQuerySchema.parse({}), actor),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies paper:create to a new member with no organization", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { User } = await import("@/models");
    const seeded = await seedTaxonomyAndQuestion();

    const member = await User.create({ name: "New Member 2", email: "newmember2@example.com", password: "x", role: "member" });
    const actor = actorFor(member._id, "member", "newmember2@example.com");

    await expect(
      paperService.create(paperInput(seeded, "Should be denied"), actor, auditFor()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows question:read once the member has an active organization membership", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { User, OrganizationMember } = await import("@/models");
    const seeded = await seedTaxonomyAndQuestion();

    const member = await User.create({
      name: "Org Member",
      email: "orgmember@example.com",
      password: "x",
      role: "member",
      organization: seeded.org._id,
    });
    await OrganizationMember.create({ userId: member._id, organizationId: seeded.org._id, role: "member", status: "active" });

    const actor = actorFor(member._id, "member", "orgmember@example.com", seeded.org._id.toString());

    const detail = await questionService.getById(seeded.question._id.toString(), actor, { requestAnswers: false });
    expect(detail).toBeTruthy();

    const { items } = await questionService.list(questionListQuerySchema.parse({}), actor);
    expect(Array.isArray(items)).toBe(true);

    // Global role is untouched by joining the organization.
    const reloaded = await User.findById(member._id).exec();
    expect(reloaded?.role).toBe("member");
  });

  it("allows paper:create once the member has an active organization membership", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { User, OrganizationMember } = await import("@/models");
    const seeded = await seedTaxonomyAndQuestion();

    const member = await User.create({
      name: "Org Member 2",
      email: "orgmember2@example.com",
      password: "x",
      role: "member",
      organization: seeded.org._id,
    });
    await OrganizationMember.create({ userId: member._id, organizationId: seeded.org._id, role: "member", status: "active" });

    const actor = actorFor(member._id, "member", "orgmember2@example.com", seeded.org._id.toString());

    const paper = await paperService.create(paperInput(seeded, "Member org paper"), actor, auditFor());
    expect(paper.title).toBe("Member org paper");
    expect(paper.createdBy.toString()).toBe(member._id.toString());
  });

  it("does not grant access via a suspended organization membership", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { User, OrganizationMember } = await import("@/models");
    const seeded = await seedTaxonomyAndQuestion();

    const member = await User.create({
      name: "Suspended Member",
      email: "suspended@example.com",
      password: "x",
      role: "member",
      organization: seeded.org._id,
    });
    await OrganizationMember.create({ userId: member._id, organizationId: seeded.org._id, role: "member", status: "suspended" });

    const actor = actorFor(member._id, "member", "suspended@example.com", seeded.org._id.toString());

    await expect(
      questionService.getById(seeded.question._id.toString(), actor, { requestAnswers: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("leaves existing teacher / moderator / organization_owner content access unchanged", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { paperService } = await import("@/lib/services/paper.service");
    const { User, OrganizationMember } = await import("@/models");
    const seeded = await seedTaxonomyAndQuestion();
    const orgId = seeded.org._id.toString();

    // These global roles already grant question:read / paper:create outright —
    // the only thing multi-tenancy adds is that they resolve content through
    // their current organization, so they are enrolled in the seed org here.
    for (const role of ["teacher", "moderator", "organization_owner"] as const) {
      const user = await User.create({
        name: role,
        email: `${role}@example.com`,
        password: "x",
        role,
        organization: seeded.org._id,
      });
      await OrganizationMember.create({ userId: user._id, organizationId: seeded.org._id, role, status: "active" });
      const actor = actorFor(user._id, role, `${role}@example.com`, orgId);

      await expect(
        questionService.getById(seeded.question._id.toString(), actor, { requestAnswers: false }),
      ).resolves.toBeTruthy();
    }

    const teacher = await User.create({
      name: "Teacher2",
      email: "teacher2@example.com",
      password: "x",
      role: "teacher",
      organization: seeded.org._id,
    });
    await OrganizationMember.create({ userId: teacher._id, organizationId: seeded.org._id, role: "teacher", status: "active" });
    const teacherActor = actorFor(teacher._id, "teacher", "teacher2@example.com", orgId);

    const paper = await paperService.create(paperInput(seeded, "Teacher paper"), teacherActor, auditFor());
    expect(paper.title).toBe("Teacher paper");
  });
});
