import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { UserRole } from "@/types/roles";
import {
  createQuestionTemplateSchema,
  type CreateQuestionTemplateInput,
} from "@/lib/validation/question-template.schema";
import { DEFAULT_PAPER_DESIGN } from "@/lib/validation/paper.schema";

const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, role: UserRole, organizationId: string | null = null): AuthContext {
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

function inputFor(overrides: Record<string, unknown> = {}): CreateQuestionTemplateInput {
  return createQuestionTemplateSchema.parse({
    name: "Class 7 Final Exam",
    description: "Standard final exam pattern",
    generationSpec: {
      totalQuestions: 25,
      totalMarks: 100,
      typeDistribution: [
        { type: "MCQ", count: 20 },
        { type: "SHORT", count: 5 },
      ],
      difficultyDistribution: [
        { difficulty: "EASY", count: 8 },
        { difficulty: "MEDIUM", count: 12 },
        { difficulty: "HARD", count: 5 },
      ],
      previousQuestions: { mode: "exclude" },
      ...(overrides.generationSpec as object),
    },
    designConfig: DEFAULT_PAPER_DESIGN,
    ...overrides,
  });
}

describe.skipIf(!available)("question pattern template service", () => {
  async function seedOrg(name: string, slug: string) {
    const { Organization } = await import("@/models");
    return Organization.create({ name, slug });
  }

  async function enrol(userId: Types.ObjectId, organizationId: Types.ObjectId) {
    const { OrganizationMember } = await import("@/models");
    await OrganizationMember.create({ userId, organizationId, role: "member", status: "active" });
  }

  it("lets a moderator create a template and persists both config blobs", async () => {
    const { questionTemplateService } = await import("@/lib/services/question-template.service");
    const { Subject, Category, Organization } = await import("@/models");

    const org = await seedOrg("Alpha Org", "alpha-org");
    const category = await Category.create({ organizationId: org._id, name: "Class 7", slug: "class-7" });
    const subject = await Subject.create({
      organizationId: org._id,
      name: "Science",
      slug: "science",
      category: category._id,
    });

    const modId = new Types.ObjectId();
    await enrol(modId, org._id);
    const mod = actorFor(modId, "moderator", org._id.toString());

    const created = await questionTemplateService.create(
      inputFor({
        generationSpec: {
          category: category._id.toString(),
          subject: subject._id.toString(),
          totalQuestions: 25,
          totalMarks: 100,
          typeDistribution: [
            { type: "MCQ", count: 20 },
            { type: "SHORT", count: 5 },
          ],
        },
      }),
      mod,
      audit,
    );

    expect(created.name).toBe("Class 7 Final Exam");
    expect(String(created.organizationId)).toBe(org._id.toString());
    // Denormalised for list display / filtering.
    expect(String(created.subject)).toBe(subject._id.toString());
    // Both config blobs stored verbatim.
    expect((created.generationSpec as Record<string, unknown>).totalQuestions).toBe(25);
    expect((created.designConfig as Record<string, unknown>).heading).toBeTruthy();

    await Organization.deleteOne({ _id: org._id });
  });

  it("forbids a content_writer from creating a template but still lets them list", async () => {
    const { questionTemplateService } = await import("@/lib/services/question-template.service");
    const { ForbiddenError } = await import("@/lib/errors/app-error");

    const org = await seedOrg("Beta Org", "beta-org");
    const modId = new Types.ObjectId();
    await enrol(modId, org._id);
    const mod = actorFor(modId, "moderator", org._id.toString());
    await questionTemplateService.create(inputFor(), mod, audit);

    const writerId = new Types.ObjectId();
    await enrol(writerId, org._id);
    const writer = actorFor(writerId, "content_writer", org._id.toString());

    await expect(questionTemplateService.create(inputFor({ name: "Nope" }), writer, audit)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    // Reading is allowed for a template:read holder.
    const { items } = await questionTemplateService.list(
      { page: 1, limit: 20, search: undefined, subject: undefined, organizationId: undefined },
      writer,
    );
    expect(items).toHaveLength(1);
  });

  it("isolates templates by organization", async () => {
    const { questionTemplateService } = await import("@/lib/services/question-template.service");
    const { NotFoundError } = await import("@/lib/errors/app-error");

    const orgA = await seedOrg("Org A", "org-a");
    const orgB = await seedOrg("Org B", "org-b");

    const aId = new Types.ObjectId();
    await enrol(aId, orgA._id);
    const actorA = actorFor(aId, "moderator", orgA._id.toString());

    const bId = new Types.ObjectId();
    await enrol(bId, orgB._id);
    const actorB = actorFor(bId, "moderator", orgB._id.toString());

    const created = await questionTemplateService.create(inputFor(), actorA, audit);

    // Org B sees nothing and cannot fetch or mutate Org A's template.
    const listB = await questionTemplateService.list(
      { page: 1, limit: 20, search: undefined, subject: undefined, organizationId: undefined },
      actorB,
    );
    expect(listB.items).toHaveLength(0);
    await expect(questionTemplateService.getById(created._id.toString(), actorB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      questionTemplateService.update(created._id.toString(), { name: "Hijack" }, actorB, audit),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("duplicates into an independent copy and leaves the original unchanged", async () => {
    const { questionTemplateService } = await import("@/lib/services/question-template.service");

    const org = await seedOrg("Dup Org", "dup-org");
    const modId = new Types.ObjectId();
    await enrol(modId, org._id);
    const mod = actorFor(modId, "moderator", org._id.toString());

    const original = await questionTemplateService.create(inputFor(), mod, audit);
    const copy = await questionTemplateService.duplicate(original._id.toString(), mod, audit);

    expect(copy._id.toString()).not.toBe(original._id.toString());
    expect(copy.name).toBe("Class 7 Final Exam (copy)");

    // Editing the copy must not touch the original.
    await questionTemplateService.update(
      copy._id.toString(),
      { generationSpec: { totalQuestions: 10, typeDistribution: [{ type: "MCQ", count: 10 }] } as never },
      mod,
      audit,
    );

    const reloadedOriginal = await questionTemplateService.getById(original._id.toString(), mod);
    expect((reloadedOriginal.generationSpec as Record<string, unknown>).totalQuestions).toBe(25);
  });

  it("soft-deletes a template out of every read path", async () => {
    const { questionTemplateService } = await import("@/lib/services/question-template.service");
    const { NotFoundError } = await import("@/lib/errors/app-error");

    const org = await seedOrg("Del Org", "del-org");
    const modId = new Types.ObjectId();
    await enrol(modId, org._id);
    const mod = actorFor(modId, "moderator", org._id.toString());

    const created = await questionTemplateService.create(inputFor(), mod, audit);
    await questionTemplateService.remove(created._id.toString(), mod, audit);

    const { items } = await questionTemplateService.list(
      { page: 1, limit: 20, search: undefined, subject: undefined, organizationId: undefined },
      mod,
    );
    expect(items).toHaveLength(0);
    await expect(questionTemplateService.getById(created._id.toString(), mod)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a duplicate template name within the same organization", async () => {
    const { questionTemplateService } = await import("@/lib/services/question-template.service");
    const { ConflictError } = await import("@/lib/errors/app-error");

    const org = await seedOrg("Name Org", "name-org");
    const modId = new Types.ObjectId();
    await enrol(modId, org._id);
    const mod = actorFor(modId, "moderator", org._id.toString());

    await questionTemplateService.create(inputFor(), mod, audit);
    await expect(questionTemplateService.create(inputFor(), mod, audit)).rejects.toBeInstanceOf(ConflictError);
  });
});
