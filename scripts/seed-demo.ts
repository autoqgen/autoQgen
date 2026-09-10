import { Types } from "mongoose";

import { loadEnvFiles } from "./load-env";

loadEnvFiles();

/**
 * Multi-organization demo seed.
 *
 * Wipes every organization-related collection and rebuilds a clean, fully
 * isolated two-tenant dataset from scratch:
 *
 *   - Two independent organizations: "Abdullah Organization", "Udbash Organization"
 *   - 5 members per organization (owner / team admin / teacher / reviewer /
 *     moderator), all distinct users — nobody belongs to both organizations
 *   - Separate teams, taxonomy (category → subject → chapter → topic),
 *     questions and question papers per organization
 *   - One pending invitation per organization
 *   - One platform Super Admin that belongs to neither organization
 *   - Global, shared Board / Exam records (never duplicated per organization)
 *
 * Both organizations are built by the SAME generic code path from a data spec —
 * there is no per-organization special-casing anywhere in this script.
 *
 * Deterministic: no randomness. Re-running it against any database produces the
 * exact same dataset. Safe to run repeatedly.
 *
 * After seeding, a verification phase asserts every isolation guarantee and
 * fails the script (non-zero exit) if any of them is violated.
 *
 *   npm run seed:demo
 */

const DEMO_PASSWORD = "1234";
const QUESTIONS_PER_CHAPTER = 6;
const FIXED_DATE = new Date("2025-01-01T00:00:00.000Z");
const INVITE_EXPIRES_AT = new Date("2099-01-01T00:00:00.000Z");

/* ========================================================================== */
/*  Data specs — both organizations flow through the same builder             */
/* ========================================================================== */

interface ChapterSpec {
  name: string;
  chapterNo: number;
  topics: string[];
}
interface SubjectSpec {
  name: string;
  chapters: ChapterSpec[];
}
interface CategorySpec {
  name: string;
  subjects: SubjectSpec[];
}
interface PaperSpec {
  title: string;
  categoryName: string;
  subjectName: string;
}
interface OrgSpec {
  name: string;
  slug: string;
  /** Prefix for this organization's member email addresses. */
  emailKey: string;
  categories: CategorySpec[];
  papers: PaperSpec[];
}

/** Same five roles for every organization. `org` drives OrganizationMember.role, `global` drives User.role. */
const MEMBER_ROLES = [
  { key: "owner", label: "Organization Owner", org: "organization_owner", global: "organization_owner" },
  { key: "teamadmin", label: "Team Admin", org: "team_admin", global: "team_admin" },
  { key: "teacher", label: "Teacher", org: "teacher", global: "teacher" },
  { key: "reviewer", label: "Reviewer", org: "reviewer", global: "reviewer" },
  { key: "moderator", label: "Moderator", org: "moderator", global: "moderator" },
] as const;

const TEAM_NAMES = ["Alpha Team", "Beta Team"] as const;
/** Which team (by index into TEAM_NAMES) each member role is assigned to; null = no team. */
const TEAM_ASSIGNMENT: Record<(typeof MEMBER_ROLES)[number]["key"], number | null> = {
  owner: null,
  teamadmin: 0,
  teacher: 0,
  reviewer: 1,
  moderator: null,
};

const ORG_SPECS: OrgSpec[] = [
  {
    name: "Abdullah Organization",
    slug: "abdullah-organization",
    emailKey: "abdullah",
    categories: [
      {
        name: "Class 9",
        subjects: [
          {
            name: "Mathematics",
            chapters: [
              { name: "Algebra", chapterNo: 1, topics: ["Linear Equations", "Quadratic Equations"] },
              { name: "Geometry", chapterNo: 2, topics: ["Triangles"] },
            ],
          },
          {
            name: "Bangla",
            chapters: [
              { name: "Gadya", chapterNo: 1, topics: ["Nimgach"] },
              { name: "Poddo", chapterNo: 2, topics: ["Kobita Porichiti"] },
            ],
          },
        ],
      },
      {
        name: "Class 10",
        subjects: [
          {
            name: "Mathematics",
            chapters: [
              { name: "Trigonometry", chapterNo: 1, topics: ["Trigonometric Ratios"] },
              { name: "Statistics", chapterNo: 2, topics: ["Mean, Median, Mode"] },
            ],
          },
          {
            name: "English",
            chapters: [
              { name: "Grammar", chapterNo: 1, topics: ["Tenses"] },
              { name: "Composition", chapterNo: 2, topics: ["Paragraph Writing"] },
            ],
          },
        ],
      },
    ],
    papers: [
      { title: "Class 9 Mathematics — Model Test", categoryName: "Class 9", subjectName: "Mathematics" },
      { title: "Class 9 Bangla — Model Test", categoryName: "Class 9", subjectName: "Bangla" },
      { title: "Class 10 Mathematics — Model Test", categoryName: "Class 10", subjectName: "Mathematics" },
    ],
  },
  {
    name: "Udbash Organization",
    slug: "udbash-organization",
    emailKey: "udbash",
    categories: [
      {
        name: "Class 8",
        subjects: [
          {
            name: "Science",
            chapters: [
              { name: "Living World", chapterNo: 1, topics: ["Cells and Tissues"] },
              { name: "Force and Pressure", chapterNo: 2, topics: ["Types of Force"] },
            ],
          },
          {
            name: "English",
            chapters: [
              { name: "Reading", chapterNo: 1, topics: ["Comprehension"] },
              { name: "Writing", chapterNo: 2, topics: ["Formal Letters"] },
            ],
          },
        ],
      },
      {
        name: "Class 9",
        subjects: [
          {
            name: "Physics",
            chapters: [
              { name: "Motion", chapterNo: 1, topics: ["Velocity and Acceleration", "Equations of Motion"] },
              { name: "Work, Energy and Power", chapterNo: 2, topics: ["Kinetic Energy"] },
            ],
          },
          {
            name: "Chemistry",
            chapters: [
              { name: "Atomic Structure", chapterNo: 1, topics: ["Sub-atomic Particles"] },
              { name: "Periodic Table", chapterNo: 2, topics: ["Periods and Groups"] },
            ],
          },
        ],
      },
    ],
    papers: [
      { title: "Class 9 Physics — Model Test", categoryName: "Class 9", subjectName: "Physics" },
      { title: "Class 8 Science — Model Test", categoryName: "Class 8", subjectName: "Science" },
      { title: "Class 9 Chemistry — Model Test", categoryName: "Class 9", subjectName: "Chemistry" },
    ],
  },
];

/* ========================================================================== */
/*  Helpers                                                                    */
/* ========================================================================== */

function mustExist<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Seed failed: ${what} was not created.`);
  }
  return value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const failures: string[] = [];
function check(label: string, ok: boolean): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures.push(label);
  }
}

/* ========================================================================== */
/*  Main                                                                       */
/* ========================================================================== */

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo seed must not be run against a production database.");
  }

  const { connectDB, disconnectDB } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/auth/password");
  const { questionContentHash, sha256 } = await import("@/lib/security/hash");
  const {
    User,
    Organization,
    OrganizationMember,
    OrganizationInvitation,
    Team,
    Category,
    Subject,
    Chapter,
    Topic,
    Question,
    QuestionPaper,
    Board,
    Exam,
    AuditLog,
    PasswordResetToken,
  } = await import("@/models");
  const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
  const { resolveContentOrganizationId } = await import("@/lib/auth/org-session");
  type AuthContext = import("@/lib/auth/session").AuthContext;
  type GeneratePaperInput = import("@/lib/validation/paper.schema").GeneratePaperInput;

  await connectDB();
  console.log("Connected.\n");

  /* ---------------------------------------------------------------------- */
  /*  1. Clean slate                                                        */
  /* ---------------------------------------------------------------------- */

  console.log("Clearing existing data…");
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    OrganizationMember.deleteMany({}),
    OrganizationInvitation.deleteMany({}),
    Team.deleteMany({}),
    Category.deleteMany({}),
    Subject.deleteMany({}),
    Chapter.deleteMany({}),
    Topic.deleteMany({}),
    Question.deleteMany({}),
    QuestionPaper.deleteMany({}),
    Board.deleteMany({}),
    Exam.deleteMany({}),
    AuditLog.deleteMany({}),
    PasswordResetToken.deleteMany({}),
  ]);
  console.log("  All organization, user and academic collections cleared.");

  // Drop stale indexes left over from the pre-multi-tenant schema (e.g. a global
  // unique `slug_1` on categories) and rebuild every collection's indexes to
  // match the current models — otherwise two organizations sharing a slug/name
  // collide on an index that should no longer exist.
  const indexedModels = [
    User,
    Organization,
    OrganizationMember,
    OrganizationInvitation,
    Team,
    Category,
    Subject,
    Chapter,
    Topic,
    Question,
    QuestionPaper,
    Board,
    Exam,
  ];
  for (const m of indexedModels) {
    await m.syncIndexes();
  }
  console.log("  Indexes synced to the current schema.\n");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  /* ---------------------------------------------------------------------- */
  /*  2. Global, shared Board / Exam (never per-organization)               */
  /* ---------------------------------------------------------------------- */

  console.log("Creating global Board / Exam records…");
  const boards = await Board.create([
    { name: "Dhaka Board", slug: "dhaka-board", shortName: "DHK", country: "Bangladesh", order: 1 },
    { name: "Jashore Board", slug: "jashore-board", shortName: "JES", country: "Bangladesh", order: 2 },
  ]);
  const globalBoard = mustExist(boards[0], "board Dhaka Board");

  const exams = await Exam.create([
    { name: "SSC 2024", slug: "ssc-2024", type: "SSC", board: globalBoard._id, year: 2024, order: 1 },
    { name: "SSC 2025", slug: "ssc-2025", type: "SSC", board: globalBoard._id, year: 2025, order: 2 },
  ]);
  const globalExam = mustExist(exams[0], "exam SSC 2024");
  console.log(`  ${boards.length} boards, ${exams.length} exams (shared by every organization).\n`);

  /* ---------------------------------------------------------------------- */
  /*  3. Platform Super Admin — belongs to no organization                 */
  /* ---------------------------------------------------------------------- */

  const superAdmin = mustExist(
    await User.create({
      name: "Super Admin",
      email: "superadmin@demo.test",
      password: passwordHash,
      role: "super_admin",
      status: "active",
      emailVerified: FIXED_DATE,
      organization: null,
    }),
    "user superadmin@demo.test",
  );
  console.log(`Super Admin: ${superAdmin.email} (organization: none)\n`);

  /* ---------------------------------------------------------------------- */
  /*  4. Build each organization through one shared code path              */
  /* ---------------------------------------------------------------------- */

  interface BuiltOrg {
    spec: OrgSpec;
    id: Types.ObjectId;
    memberUserIds: Map<string, Types.ObjectId>;
    memberDocIds: Map<string, Types.ObjectId>;
    teamIds: Types.ObjectId[];
    invitationId: Types.ObjectId;
    categoryByName: Map<string, Types.ObjectId>;
    subjectByKey: Map<string, Types.ObjectId>;
    chapterIds: Types.ObjectId[];
    topicIds: Types.ObjectId[];
    questionIds: Types.ObjectId[];
    paperIds: Types.ObjectId[];
  }

  const built: BuiltOrg[] = [];

  for (const spec of ORG_SPECS) {
    console.log(`Building "${spec.name}"…`);

    const org = mustExist(
      await Organization.create({ name: spec.name, slug: spec.slug, isActive: true, createdBy: superAdmin._id }),
      `organization ${spec.slug}`,
    );

    /* ---- 4a. Members (distinct users + membership rows) ---- */
    const memberUserIds = new Map<string, Types.ObjectId>();
    const memberDocIds = new Map<string, Types.ObjectId>();

    for (const role of MEMBER_ROLES) {
      const user = mustExist(
        await User.create({
          name: `${role.label} — ${spec.name}`,
          email: `${role.key}.${spec.emailKey}@demo.test`,
          password: passwordHash,
          role: role.global,
          status: "active",
          emailVerified: FIXED_DATE,
          organization: org._id,
        }),
        `user ${role.key}.${spec.emailKey}@demo.test`,
      );
      memberUserIds.set(role.key, user._id);
    }

    /* ---- 4b. Teams ---- */
    const teamIds: Types.ObjectId[] = [];
    for (const teamName of TEAM_NAMES) {
      const team = mustExist(
        await Team.create({
          organizationId: org._id,
          name: teamName,
          description: `${teamName} of ${spec.name}`,
          createdBy: memberUserIds.get("owner")!,
          isActive: true,
        }),
        `team ${teamName} (${spec.slug})`,
      );
      teamIds.push(team._id);
    }

    /* ---- 4c. Membership rows, with team assignment ---- */
    for (const role of MEMBER_ROLES) {
      const teamIdx = TEAM_ASSIGNMENT[role.key];
      const member = mustExist(
        await OrganizationMember.create({
          userId: memberUserIds.get(role.key)!,
          organizationId: org._id,
          role: role.org,
          teamId: teamIdx === null ? null : teamIds[teamIdx],
          status: "active",
          invitedBy: role.key === "owner" ? superAdmin._id : memberUserIds.get("owner")!,
          joinedAt: FIXED_DATE,
        }),
        `membership ${role.key} (${spec.slug})`,
      );
      memberDocIds.set(role.key, member._id);
    }

    // The organization's recorded owner.
    await Organization.updateOne({ _id: org._id }, { $set: { owner: memberUserIds.get("owner")! } }).exec();

    /* ---- 4d. One pending invitation (deterministic token) ---- */
    const invitation = mustExist(
      await OrganizationInvitation.create({
        organizationId: org._id,
        email: `newcomer.${spec.emailKey}@demo.test`,
        role: "teacher",
        teamId: null,
        invitedBy: memberUserIds.get("owner")!,
        tokenHash: sha256(`seed-demo-invitation::${spec.slug}`),
        status: "pending",
        expiresAt: INVITE_EXPIRES_AT,
      }),
      `invitation (${spec.slug})`,
    );

    /* ---- 4e. Taxonomy ---- */
    const categoryByName = new Map<string, Types.ObjectId>();
    const subjectByKey = new Map<string, Types.ObjectId>(); // key: `${categoryName}::${subjectName}`
    const chapterIds: Types.ObjectId[] = [];
    const topicIds: Types.ObjectId[] = [];

    interface ChapterCtx {
      categoryName: string;
      subjectName: string;
      categoryId: Types.ObjectId;
      subjectId: Types.ObjectId;
      chapterId: Types.ObjectId;
      chapterName: string;
      topicId: Types.ObjectId | null;
    }
    const chapterCtxs: ChapterCtx[] = [];

    let categoryOrder = 0;
    for (const catSpec of spec.categories) {
      categoryOrder += 1;
      const category = mustExist(
        await Category.create({
          organizationId: org._id,
          name: catSpec.name,
          slug: slugify(catSpec.name),
          description: `${catSpec.name} — ${spec.name}`,
          order: categoryOrder,
          isActive: true,
          createdBy: memberUserIds.get("owner")!,
        }),
        `category ${catSpec.name} (${spec.slug})`,
      );
      categoryByName.set(catSpec.name, category._id);

      let subjectOrder = 0;
      for (const subSpec of catSpec.subjects) {
        subjectOrder += 1;
        const subject = mustExist(
          await Subject.create({
            organizationId: org._id,
            name: subSpec.name,
            slug: slugify(subSpec.name),
            category: category._id,
            classLevel: catSpec.name,
            order: subjectOrder,
            isActive: true,
            createdBy: memberUserIds.get("owner")!,
          }),
          `subject ${catSpec.name}/${subSpec.name} (${spec.slug})`,
        );
        subjectByKey.set(`${catSpec.name}::${subSpec.name}`, subject._id);

        for (const chapSpec of subSpec.chapters) {
          const chapter = mustExist(
            await Chapter.create({
              organizationId: org._id,
              name: chapSpec.name,
              slug: slugify(`${subSpec.name}-${chapSpec.name}`),
              chapterNo: chapSpec.chapterNo,
              description: "",
              category: category._id,
              subject: subject._id,
              order: chapSpec.chapterNo,
              isActive: true,
              createdBy: memberUserIds.get("owner")!,
            }),
            `chapter ${chapSpec.name} (${spec.slug})`,
          );
          chapterIds.push(chapter._id);

          let firstTopicId: Types.ObjectId | null = null;
          let topicOrder = 0;
          for (const topicName of chapSpec.topics) {
            topicOrder += 1;
            const topic = mustExist(
              await Topic.create({
                organizationId: org._id,
                name: topicName,
                slug: slugify(`${chapSpec.name}-${topicName}`),
                description: "",
                category: category._id,
                subject: subject._id,
                chapter: chapter._id,
                order: topicOrder,
                isActive: true,
                createdBy: memberUserIds.get("owner")!,
              }),
              `topic ${topicName} (${spec.slug})`,
            );
            topicIds.push(topic._id);
            if (!firstTopicId) firstTopicId = topic._id;
          }

          chapterCtxs.push({
            categoryName: catSpec.name,
            subjectName: subSpec.name,
            categoryId: category._id,
            subjectId: subject._id,
            chapterId: chapter._id,
            chapterName: chapSpec.name,
            topicId: firstTopicId,
          });
        }
      }
    }

    /* ---- 4f. Questions (deterministic, org-scoped) ---- */
    const teacherId = memberUserIds.get("teacher")!;
    const reviewerId = memberUserIds.get("reviewer")!;
    const questionDocs: Record<string, unknown>[] = [];

    for (const ctx of chapterCtxs) {
      for (let i = 0; i < QUESTIONS_PER_CHAPTER; i += 1) {
        const kind = i % 3; // 0 MCQ, 1 TRUE_FALSE, 2 SHORT
        const difficulty = (["EASY", "MEDIUM", "HARD"] as const)[i % 3];
        const status = i === QUESTIONS_PER_CHAPTER - 1 ? "PENDING" : "APPROVED";
        const type = kind === 0 ? "MCQ" : kind === 1 ? "TRUE_FALSE" : "SHORT";

        const text =
          `[${spec.name} · ${ctx.categoryName} · ${ctx.subjectName} · ${ctx.chapterName}] ` +
          `${type} practice question ${i + 1}`;

        const base = {
          organizationId: org._id,
          category: ctx.categoryId,
          subject: ctx.subjectId,
          chapter: ctx.chapterId,
          topic: ctx.topicId,
          board: globalBoard._id,
          exam: status === "APPROVED" ? globalExam._id : null,
          type,
          difficulty,
          language: "en" as const,
          question: { text },
          explanation: "",
          contentHash: questionContentHash(ctx.chapterId.toString(), text),
          marks: type === "SHORT" ? 3 : 1,
          year: 2024,
          tags: ["seed", spec.slug, slugify(ctx.subjectName)],
          status,
          isActive: true,
          createdBy: teacherId,
          approvedBy: status === "APPROVED" ? reviewerId : null,
          approvedAt: status === "APPROVED" ? FIXED_DATE : null,
        };

        if (type === "MCQ") {
          questionDocs.push({
            ...base,
            options: [
              { id: "A", text: "Option A" },
              { id: "B", text: "Option B" },
              { id: "C", text: "Option C" },
              { id: "D", text: "Option D" },
            ],
            answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
          });
        } else if (type === "TRUE_FALSE") {
          questionDocs.push({
            ...base,
            options: [],
            answer: { text: "", correctOptions: [], booleanAnswer: i % 2 === 0, matchingPairs: [] },
          });
        } else {
          questionDocs.push({
            ...base,
            options: [],
            answer: {
              text: `Model answer for ${ctx.chapterName} practice question ${i + 1}.`,
              correctOptions: [],
              booleanAnswer: null,
              matchingPairs: [],
            },
          });
        }
      }
    }

    const insertedQuestions = await Question.insertMany(questionDocs);
    const questionIds = insertedQuestions.map((q) => q._id as Types.ObjectId);

    /* ---- 4g. Question papers (MANUAL, this organization's questions only) ---- */
    const paperIds: Types.ObjectId[] = [];
    let paperIndex = 0;
    for (const paperSpec of spec.papers) {
      const subjectId = mustExist(
        subjectByKey.get(`${paperSpec.categoryName}::${paperSpec.subjectName}`),
        `paper subject ${paperSpec.subjectName}`,
      );
      const categoryId = mustExist(categoryByName.get(paperSpec.categoryName), `paper category ${paperSpec.categoryName}`);

      const approved = await Question.find({
        organizationId: org._id,
        subject: subjectId,
        status: "APPROVED",
        isActive: true,
      })
        .sort({ _id: 1 })
        .limit(8)
        .select("_id marks")
        .lean()
        .exec();

      const questions = approved.map((q, idx) => ({
        question: q._id,
        order: idx,
        marks: q.marks ?? 1,
        note: "",
      }));
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      const isPublished = paperIndex === 0;

      const paper = mustExist(
        await QuestionPaper.create({
          organizationId: org._id,
          title: paperSpec.title,
          description: `${paperSpec.title} — ${spec.name}`,
          instructions: "Answer all questions.",
          category: categoryId,
          subject: subjectId,
          board: globalBoard._id,
          exam: globalExam._id,
          year: 2024,
          mode: "MANUAL",
          status: isPublished ? "PUBLISHED" : "DRAFT",
          durationMinutes: 90,
          totalMarks,
          totalQuestions: questions.length,
          sections: [{ title: "Section A", instructions: "", order: 0, questions }],
          generationSpec: null,
          createdBy: memberUserIds.get("teacher")!,
          publishedBy: isPublished ? memberUserIds.get("owner")! : null,
          publishedAt: isPublished ? FIXED_DATE : null,
          isActive: true,
        }),
        `paper ${paperSpec.title} (${spec.slug})`,
      );
      paperIds.push(paper._id);
      paperIndex += 1;
    }

    console.log(
      `  members=5  teams=${teamIds.length}  categories=${spec.categories.length}  ` +
        `chapters=${chapterIds.length}  topics=${topicIds.length}  ` +
        `questions=${questionIds.length}  papers=${paperIds.length}  invitations=1`,
    );

    built.push({
      spec,
      id: org._id,
      memberUserIds,
      memberDocIds,
      teamIds,
      invitationId: invitation._id,
      categoryByName,
      subjectByKey,
      chapterIds,
      topicIds,
      questionIds,
      paperIds,
    });
  }

  if (built.length !== ORG_SPECS.length) {
    throw new Error("Seed failed: not every organization was built.");
  }
  const [orgA, orgB] = built as [BuiltOrg, BuiltOrg];

  /* ---------------------------------------------------------------------- */
  /*  5. Verification                                                       */
  /* ---------------------------------------------------------------------- */

  console.log("\nVerifying multi-tenancy isolation…\n");

  for (const org of built) {
    const activeMembers = await OrganizationMember.countDocuments({ organizationId: org.id, status: "active" });
    check(`${org.spec.name}: exactly 5 active members`, activeMembers === 5);

    const owners = await OrganizationMember.countDocuments({ organizationId: org.id, role: "organization_owner" });
    check(`${org.spec.name}: exactly 1 organization owner`, owners === 1);

    const orgDoc = await Organization.findById(org.id).lean().exec();
    const ownerUserId = org.memberUserIds.get("owner")!;
    check(
      `${org.spec.name}: Organization.owner matches the owner membership`,
      Boolean(orgDoc?.owner) && orgDoc!.owner!.toString() === ownerUserId.toString(),
    );
    const ownerMembership = await OrganizationMember.findOne({
      organizationId: org.id,
      userId: ownerUserId,
    })
      .lean()
      .exec();
    check(
      `${org.spec.name}: owner's membership role is organization_owner`,
      ownerMembership?.role === "organization_owner",
    );
  }

  // No user belongs to both organizations.
  const aUserIds = new Set([...orgA.memberUserIds.values()].map((v) => v.toString()));
  const bUserIds = new Set([...orgB.memberUserIds.values()].map((v) => v.toString()));
  const sharedUsers = [...aUserIds].filter((v) => bUserIds.has(v));
  check("No user is a member of both organizations", sharedUsers.length === 0);

  const dupMemberships = await OrganizationMember.aggregate([
    { $group: { _id: "$userId", orgs: { $addToSet: "$organizationId" } } },
    { $match: { "orgs.1": { $exists: true } } },
  ]);
  check("No user holds memberships in more than one organization", dupMemberships.length === 0);

  const membersWithMismatchedPointer = await User.countDocuments({
    _id: { $in: [...aUserIds, ...bUserIds].map((v) => new Types.ObjectId(v)) },
    organization: null,
  });
  check("Every member's User.organization pointer is set", membersWithMismatchedPointer === 0);

  check("Super Admin belongs to no organization", (await User.findById(superAdmin._id).lean().exec())?.organization == null);

  /* ---- Cross-organization data leakage probes (the core requirement) ---- */

  interface Probe {
    label: string;
    model: { countDocuments: (f: Record<string, unknown>) => { exec: () => Promise<number> } };
    aIds: Types.ObjectId[];
    bIds: Types.ObjectId[];
  }
  const probes: Probe[] = [
    { label: "Categories", model: Category, aIds: [...orgA.categoryByName.values()], bIds: [...orgB.categoryByName.values()] },
    { label: "Subjects", model: Subject, aIds: [...orgA.subjectByKey.values()], bIds: [...orgB.subjectByKey.values()] },
    { label: "Chapters", model: Chapter, aIds: orgA.chapterIds, bIds: orgB.chapterIds },
    { label: "Topics", model: Topic, aIds: orgA.topicIds, bIds: orgB.topicIds },
    { label: "Questions", model: Question, aIds: orgA.questionIds, bIds: orgB.questionIds },
    { label: "Question Papers", model: QuestionPaper, aIds: orgA.paperIds, bIds: orgB.paperIds },
    { label: "Teams", model: Team, aIds: orgA.teamIds, bIds: orgB.teamIds },
    { label: "Members", model: OrganizationMember, aIds: [...orgA.memberDocIds.values()], bIds: [...orgB.memberDocIds.values()] },
    { label: "Invitations", model: OrganizationInvitation, aIds: [orgA.invitationId], bIds: [orgB.invitationId] },
  ];

  for (const probe of probes) {
    // Every A id must be invisible when the query is scoped to organization B, and vice-versa.
    const leakIntoB = await probe.model.countDocuments({ organizationId: orgB.id, _id: { $in: probe.aIds } }).exec();
    const leakIntoA = await probe.model.countDocuments({ organizationId: orgA.id, _id: { $in: probe.bIds } }).exec();
    check(`${probe.label}: ${orgA.spec.name} rows are invisible under ${orgB.spec.name} scope`, leakIntoB === 0);
    check(`${probe.label}: ${orgB.spec.name} rows are invisible under ${orgA.spec.name} scope`, leakIntoA === 0);
  }

  // Every question references taxonomy from its own organization only.
  for (const org of built) {
    const other = org === orgA ? orgB : orgA;
    const badRefs = await Question.countDocuments({
      organizationId: org.id,
      $or: [
        { category: { $in: [...other.categoryByName.values()] } },
        { subject: { $in: [...other.subjectByKey.values()] } },
        { chapter: { $in: other.chapterIds } },
        { topic: { $in: other.topicIds } },
      ],
    });
    check(`${org.spec.name}: no question references another organization's taxonomy`, badRefs === 0);
  }

  // Every paper contains only its own organization's questions.
  for (const org of built) {
    const papers = await QuestionPaper.find({ organizationId: org.id }).lean().exec();
    let mixed = 0;
    for (const paper of papers) {
      const qids = paper.sections.flatMap((s) => s.questions.map((q) => q.question));
      const foreign = await Question.countDocuments({
        _id: { $in: qids },
        organizationId: { $ne: org.id },
      });
      if (foreign > 0) mixed += 1;
    }
    check(`${org.spec.name}: every question paper uses only its own questions`, mixed === 0);
  }

  /* ---- Paper generation never crosses the tenant boundary ---- */
  for (const org of built) {
    const other = org === orgA ? orgB : orgA;
    const firstCat = org.spec.categories[0]!;
    const firstSub = firstCat.subjects[0]!;
    const categoryId = org.categoryByName.get(firstCat.name)!;
    const subjectId = org.subjectByKey.get(`${firstCat.name}::${firstSub.name}`)!;
    const chapterIds = (
      await Chapter.find({ organizationId: org.id, subject: subjectId }).select("_id").lean().exec()
    ).map((c) => c._id.toString());

    const spec = {
      organizationId: undefined,
      category: categoryId.toString(),
      subject: subjectId.toString(),
      chapters: chapterIds,
      topics: [],
      board: null,
      exam: null,
      year: null,
      language: null,
      totalQuestions: 5,
      totalMarks: null,
      difficultyDistribution: [],
      typeDistribution: [],
      status: "APPROVED",
    } as unknown as GeneratePaperInput;

    const result = await paperGeneratorService.generate(spec, org.id.toString());
    check(`${org.spec.name}: generation returned questions`, result.questions.length > 0);

    const generatedIds = result.questions.map((q) => q.id);
    const foreignCount = await Question.countDocuments({
      _id: { $in: generatedIds.map((id) => new Types.ObjectId(id)) },
      organizationId: { $ne: org.id },
    });
    check(`${org.spec.name}: generation pulled 0 questions from ${other.spec.name}`, foreignCount === 0);

    const otherIdSet = new Set(other.questionIds.map((v) => v.toString()));
    check(
      `${org.spec.name}: none of the generated ids belong to ${other.spec.name}`,
      generatedIds.every((id) => !otherIdSet.has(id)),
    );
  }

  /* ---- Super Admin context resolution ---- */
  const superCtx: AuthContext = {
    id: superAdmin._id.toString(),
    objectId: superAdmin._id,
    email: superAdmin.email,
    name: superAdmin.name,
    role: "super_admin",
    status: "active",
    organizationId: null,
  };

  check(
    "Super Admin can select Abdullah Organization context",
    (await resolveContentOrganizationId(superCtx, orgA.id.toString())) === orgA.id.toString(),
  );
  check(
    "Super Admin can switch to Udbash Organization context",
    (await resolveContentOrganizationId(superCtx, orgB.id.toString())) === orgB.id.toString(),
  );
  check(
    "Super Admin resolves to null for a non-existent organization",
    (await resolveContentOrganizationId(superCtx, new Types.ObjectId().toString())) === null,
  );

  // A non-super-admin member cannot cross tenants by supplying an override id.
  const teacherA = orgA.memberUserIds.get("teacher")!;
  const memberCtx: AuthContext = {
    id: teacherA.toString(),
    objectId: teacherA,
    email: `teacher.${orgA.spec.emailKey}@demo.test`,
    name: "Teacher",
    role: "teacher",
    status: "active",
    organizationId: orgA.id.toString(),
  };
  check(
    `${orgA.spec.name} member's org override to ${orgB.spec.name} is ignored`,
    (await resolveContentOrganizationId(memberCtx, orgB.id.toString())) === orgA.id.toString(),
  );

  /* ---- Global Board / Exam are shared, not duplicated ---- */
  check("Exactly 2 global Board records exist", (await Board.countDocuments({})) === 2);
  check("Exactly 2 global Exam records exist", (await Exam.countDocuments({})) === 2);
  for (const org of built) {
    const distinctBoards = await Question.distinct("board", { organizationId: org.id });
    const allGlobal = distinctBoards.every((b) => b && b.toString() === globalBoard._id.toString());
    check(`${org.spec.name}: questions reference the shared global Board`, allGlobal);
  }

  /* ---------------------------------------------------------------------- */
  /*  6. Summary                                                            */
  /* ---------------------------------------------------------------------- */

  console.log("\n────────────────────────────────────────────────────────");
  if (failures.length > 0) {
    console.log(`VERIFICATION FAILED — ${failures.length} check(s) did not pass:`);
    for (const f of failures) console.log(`  - ${f}`);
    console.log("────────────────────────────────────────────────────────");
    await disconnectDB();
    throw new Error("Seed verification failed.");
  }

  console.log("VERIFICATION PASSED — every isolation guarantee holds.");
  console.log("────────────────────────────────────────────────────────\n");

  console.log(`All passwords: ${DEMO_PASSWORD}\n`);
  console.log("Super Admin (no organization):");
  console.log("  superadmin@demo.test");
  for (const org of built) {
    console.log(`\n${org.spec.name}:`);
    for (const role of MEMBER_ROLES) {
      console.log(`  ${role.label.padEnd(20)} ${role.key}.${org.spec.emailKey}@demo.test`);
    }
    console.log(`  Pending invitation:  newcomer.${org.spec.emailKey}@demo.test`);
  }
  console.log("");

  await disconnectDB();
}

main().catch((error: unknown) => {
  console.error("\nSeed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
