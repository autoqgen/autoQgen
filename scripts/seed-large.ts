import { Types } from "mongoose";

import { loadEnvFiles } from "./load-env";

loadEnvFiles();

/**
 * Production-scale seed.
 *
 * Where `seed.ts` is a tiny idempotent dev fixture and `seed-demo.ts` is a
 * minimal two-tenant isolation harness, this script fills every collection with
 * enough realistic volume that **every list view in the product paginates** (the
 * shared page size is 20 — see `DEFAULT_PAGE_SIZE` in
 * `src/lib/validation/common.ts`).
 *
 * What it creates
 * ---------------
 *   - 1 global SystemSetting document
 *   - ~28 global Boards and ~34 global Exams (Board/Exam are not tenant-scoped)
 *   - A pool of platform staff, incl. 2 Super Admins that belong to no org
 *   - RICH_ORGS fully-populated organizations, each with:
 *       · ~34 members spanning every OrgRole, a few suspended / pending
 *       · 6 teams
 *       · ~26 pending invitations + a spread of accepted/rejected/expired/cancelled
 *       · ~22 categories → ~55 subjects → ~165 chapters → ~330 topics
 *       · ~170 questions covering all 10 types, 4 difficulties, 4 statuses,
 *         both languages, AI / human provenance
 *       · ~28 question papers: MANUAL + AUTO, DRAFT / PUBLISHED / ARCHIVED,
 *         with sections, generation specs and clones
 *   - SHELL_ORGS lightweight organizations (owner + 2 members + a little
 *     taxonomy) purely so the Admin → Organizations list runs to several pages
 *   - ~480 AuditLog entries across every action, actor and outcome
 *   - A handful of PasswordResetToken rows (active + spent)
 *
 * Safety: refuses to run when NODE_ENV=production. Wipes every collection it
 * touches and rebuilds from scratch. Deterministic — a seeded PRNG drives every
 * choice, so re-running produces the same dataset (ObjectIds aside).
 *
 *   npm run seed:large
 */

/* ========================================================================== */
/*  Tunables — dial the whole dataset up or down from here                     */
/* ========================================================================== */

const PASSWORD = process.env.SEED_PASSWORD ?? "1234";

const RICH_ORGS = 3;
const SHELL_ORGS = 26; // RICH_ORGS + SHELL_ORGS must exceed 20 to paginate the admin Organizations list

const MEMBERS_PER_RICH_ORG = 34;
const TEAMS_PER_RICH_ORG = 6;
const PENDING_INVITES_PER_RICH_ORG = 26;
const CLOSED_INVITES_PER_RICH_ORG = 8;

const CATEGORIES_PER_RICH_ORG = 22;
const SUBJECTS_PER_CATEGORY: [number, number] = [2, 3];
const CHAPTERS_PER_SUBJECT: [number, number] = [3, 4];
const TOPICS_PER_CHAPTER: [number, number] = [2, 4];
const QUESTIONS_PER_RICH_ORG = 200;
/** Questions concentrate into this many chapters so subjects reach paper-sized pools. */
const HOT_CHAPTERS_PER_RICH_ORG = 48;
const PAPERS_PER_RICH_ORG = 28;

const GLOBAL_BOARDS = 28;
const GLOBAL_EXAMS = 34;
const AUDIT_LOGS = 480;
const RESET_TOKENS = 6;

/* ========================================================================== */
/*  Deterministic PRNG + helpers                                               */
/* ========================================================================== */

/** mulberry32 — small, fast, good enough for fixture generation. */
function makePrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = makePrng(0xa11ce);

/** Integer in [min, max]. */
function int(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() from an empty array");
  return items[Math.floor(rnd() * items.length)]!;
}

/** `count` distinct items (or all of them, if the pool is smaller). */
function pickN<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  }
  return out;
}

function chance(p: number): boolean {
  return rnd() < p;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DAY_MS = 86_400_000;
const NOW = Date.now();
/** A timestamp `days` (± a little jitter) before now. */
function daysAgo(days: number): Date {
  return new Date(NOW - days * DAY_MS - Math.floor(rnd() * DAY_MS));
}

function mustExist<T>(value: T | null | undefined, what: string): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`Seed failed: ${what} was not created.`);
  }
  return value as NonNullable<T>;
}

/* ========================================================================== */
/*  Static vocabulary                                                          */
/* ========================================================================== */

const FIRST_NAMES = [
  "Ada", "Rafi", "Nusrat", "Tanvir", "Sadia", "Imran", "Farhana", "Zayan", "Mitu", "Arif",
  "Lamia", "Sabbir", "Rnumana", "Hasib", "Tisha", "Naeem", "Oishi", "Piyash", "Jarin", "Fahim",
  "Marjuk", "Sumaiya", "Rakib", "Anika", "Shakil", "Prova", "Nahid", "Tuli", "Emon", "Rima",
  "Grace", "Leon", "Mira", "Omar", "Priya", "Diego", "Yuki", "Noor", "Ivan", "Chloe",
];
const LAST_NAMES = [
  "Rahman", "Islam", "Akter", "Hossain", "Chowdhury", "Ahmed", "Khan", "Das", "Sarkar", "Bhuiyan",
  "Karim", "Haque", "Sultana", "Mahmud", "Alam", "Siddiqui", "Roy", "Talukder", "Mollah", "Nath",
  "Silva", "Petrov", "Nguyen", "Okafor", "Kim", "Meyer", "Costa", "Abbas", "Lopez", "Sato",
];

const BOARD_NAMES = [
  "Dhaka Board", "Chattogram Board", "Rajshahi Board", "Khulna Board", "Barishal Board",
  "Sylhet Board", "Rangpur Board", "Mymensingh Board", "Cumilla Board", "Jashore Board",
  "Dinajpur Board", "Madrasah Education Board", "Technical Education Board", "Cambridge International",
  "Pearson Edexcel", "International Baccalaureate", "CBSE Delhi", "ICSE", "Maharashtra State Board",
  "Kerala State Board", "Tamil Nadu State Board", "Punjab Board", "Karnataka PU Board",
  "Federal Board Islamabad", "Sindh Board", "West Bengal Council", "Gujarat State Board",
  "Rajasthan Board", "Assam Board", "Bihar Board",
];

const EXAM_TYPE_POOL = ["SSC", "HSC", "ADMISSION", "BCS", "JOB", "OTHER"] as const;

const CATEGORY_NAME_POOL = [
  "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12", "O Level", "A Level", "Admission Prep", "BCS Preliminary",
  "Bank Job Prep", "Primary Scholarship", "JSC Revision", "SSC Crash Course", "HSC Crash Course",
  "Engineering Admission", "Medical Admission", "University Unit A", "University Unit B",
  "Foundation Course", "Olympiad Track",
];
const SUBJECT_NAME_POOL = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Bangla", "ICT", "Higher Mathematics",
  "General Science", "Accounting", "Business Studies", "Economics", "Geography", "History",
  "Civics", "Islam & Moral Education", "Social Science", "Statistics",
];
const CHAPTER_TOPIC_WORDS = [
  "Introduction", "Fundamentals", "Core Concepts", "Advanced Problems", "Applications", "Theory",
  "Numericals", "Case Studies", "Revision", "Practical Work", "Historical Context", "Modern Methods",
  "Analysis", "Synthesis", "Formulae", "Diagrams", "Field Study", "Experiments", "Word Problems",
  "Proofs", "Graphs", "Data Handling", "Vocabulary", "Comprehension", "Composition",
];

const TAG_POOL = [
  "board-question", "important", "conceptual", "tricky", "formula-based", "diagram", "past-paper",
  "creative", "mcq-bank", "quick-revision", "high-yield", "commonly-missed", "application", "theory",
];
const SOURCE_POOL = [
  "SSC 2022 Dhaka", "HSC 2021 Rajshahi", "Board Question 2023", "Coaching Sheet", "Textbook Exercise",
  "Teacher Compiled", "Model Test 2024", "Admission 2023 Set B", "",
];
const SESSION_POOL = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25", ""];

const AUDIT_ACTION_POOL = [
  "auth.register", "auth.login", "auth.password.change", "auth.password.reset",
  "question.create", "question.update", "question.delete", "question.status.change",
  "question.bulk-import", "question.bulk-review",
  "taxonomy.create", "taxonomy.update", "taxonomy.delete",
  "paper.create", "paper.update", "paper.delete", "paper.clone", "paper.publish",
  "paper.archive", "paper.restore", "paper.export",
  "user.update-role", "user.suspend",
  "organization.create", "organization.update", "organization.assign-owner",
  "organization.member.update-role", "organization.member.remove",
  "organization.invitation.send", "organization.invitation.accept",
  "organization.invitation.reject", "organization.invitation.cancel",
  "organization.team.create", "organization.team.update", "organization.team.delete",
  "security.csrf-rejected", "security.rate-limited",
] as const;

function resourceTypeForAction(action: string): string {
  const prefix = action.split(".")[0]!;
  if (prefix === "auth") return "auth";
  if (prefix === "question") return "question";
  if (prefix === "paper") return "paper";
  if (prefix === "taxonomy") return "taxonomy";
  if (prefix === "user") return "user";
  if (prefix === "security") return "security";
  return "organization";
}

/** The 34 members of every rich org: OrgRole → how many, plus the global role to mirror. */
const RICH_ORG_ROLE_PLAN: { org: string; global: string; count: number; prefix: string }[] = [
  { org: "organization_owner", global: "organization_owner", count: 1, prefix: "owner" },
  { org: "team_admin", global: "team_admin", count: 3, prefix: "teamadmin" },
  { org: "teacher", global: "teacher", count: 10, prefix: "teacher" },
  { org: "content_writer", global: "content_writer", count: 6, prefix: "writer" },
  { org: "reviewer", global: "reviewer", count: 5, prefix: "reviewer" },
  { org: "moderator", global: "moderator", count: 3, prefix: "moderator" },
  { org: "student", global: "student", count: 4, prefix: "student" },
  { org: "member", global: "member", count: 2, prefix: "member" },
];

const QUESTION_TYPE_POOL = [
  "MCQ", "MULTIPLE_CORRECT", "TRUE_FALSE", "SHORT", "WRITTEN",
  "FILL_BLANK", "MATCHING", "ASSERTION_REASON", "IMAGE", "PASSAGE",
] as const;
const DIFFICULTY_POOL = ["EASY", "MEDIUM", "HARD", "EXPERT"] as const;

/* ========================================================================== */
/*  Main                                                                       */
/* ========================================================================== */

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:large must not be run against a production database.");
  }

  const plannedMembers = RICH_ORG_ROLE_PLAN.reduce((sum, r) => sum + r.count, 0);
  if (plannedMembers !== MEMBERS_PER_RICH_ORG) {
    throw new Error(
      `RICH_ORG_ROLE_PLAN sums to ${plannedMembers} but MEMBERS_PER_RICH_ORG is ${MEMBERS_PER_RICH_ORG}.`,
    );
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
    SystemSetting,
  } = await import("@/models");

  await connectDB();
  console.log("Connected.\n");

  /* ---------------------------------------------------------------------- */
  /*  1. Clean slate + index sync                                           */
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
    SystemSetting.deleteMany({}),
  ]);

  const indexedModels = [
    User, Organization, OrganizationMember, OrganizationInvitation, Team,
    Category, Subject, Chapter, Topic, Question, QuestionPaper, Board, Exam,
  ];
  for (const m of indexedModels) await m.syncIndexes();
  console.log("  Cleared and indexes synced to the current schema.\n");

  const passwordHash = await hashPassword(PASSWORD);
  const primaryOwnerPasswordHash = await hashPassword("1234");

  /* ---------------------------------------------------------------------- */
  /*  2. Global SystemSetting                                              */
  /* ---------------------------------------------------------------------- */

  await SystemSetting.create({
    key: "global",
    siteName: "AutoQgen",
    defaultLanguage: "bn",
    maxQuestionsPerPaper: "100",
    defaultPaperQuestions: "12",
    allowSelfRegistration: "true",
    maintenanceMode: "false",
  });

  /* ---------------------------------------------------------------------- */
  /*  3. Global Boards / Exams (shared by every organization)              */
  /* ---------------------------------------------------------------------- */

  console.log("Creating global Boards / Exams…");
  const boardDocs = BOARD_NAMES.slice(0, GLOBAL_BOARDS).map((name, i) => ({
    name,
    slug: slugify(name),
    shortName: name
      .replace(/board|international|state|council|education/gi, "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 6),
    country: i < 13 ? "Bangladesh" : pick(["India", "Pakistan", "United Kingdom", "International"]),
    order: i + 1,
    isActive: chance(0.92),
  }));
  const boards = await Board.insertMany(boardDocs);
  const boardIds = boards.map((b) => b._id as Types.ObjectId);

  const examDocs = Array.from({ length: GLOBAL_EXAMS }, (_, i) => {
    const type = pick(EXAM_TYPE_POOL);
    const year = int(2016, 2025);
    const name = `${type} ${year}${chance(0.4) ? ` ${pick(["Set A", "Set B", "Regular", "Improvement"])}` : ""}`;
    return {
      name,
      slug: `${slugify(type)}-${year}-${i}`,
      type,
      category: null,
      board: pick(boardIds),
      year,
      session: pick(SESSION_POOL),
      description: chance(0.5) ? `${name} — archived question set.` : "",
      order: i + 1,
      isActive: chance(0.9),
    };
  });
  const exams = await Exam.insertMany(examDocs);
  const examIds = exams.map((e) => e._id as Types.ObjectId);
  console.log(`  ${boards.length} boards, ${exams.length} exams.\n`);

  /* ---------------------------------------------------------------------- */
  /*  4. Platform staff (Super Admins belong to no organization)          */
  /* ---------------------------------------------------------------------- */

  const platformAdmins = await User.insertMany([
    {
      name: "Platform Admin", email: "superadmin@demo.test", password: passwordHash,
      role: "super_admin", status: "active", emailVerified: daysAgo(400), organization: null,
      lastLoginAt: daysAgo(0),
    },
    {
      name: "Platform Admin Two", email: "admin2@autoqgen.test", password: passwordHash,
      role: "super_admin", status: "active", emailVerified: daysAgo(360), organization: null,
      lastLoginAt: daysAgo(1),
    },
  ]);
  const superAdmin = mustExist(platformAdmins[0], "primary super admin") as { _id: Types.ObjectId };
  console.log(`Super Admins: superadmin@demo.test, admin2@autoqgen.test\n`);

  /** Every user id we create, for the audit-log actor pool. */
  const allUserIds: Types.ObjectId[] = platformAdmins.map((u) => u._id as Types.ObjectId);

  /* ---------------------------------------------------------------------- */
  /*  5. Rich organizations                                                */
  /* ---------------------------------------------------------------------- */

  interface BuiltRichOrg {
    id: Types.ObjectId;
    name: string;
    slug: string;
    orgKey: string;
    ownerId: Types.ObjectId;
    memberUserIds: Types.ObjectId[];
    teacherIds: Types.ObjectId[];
    reviewerIds: Types.ObjectId[];
  }
  const richOrgs: BuiltRichOrg[] = [];

  for (let o = 0; o < RICH_ORGS; o += 1) {
    // Generic, placeholder identities only — no real-sounding names.
    const orgKey = `org${o + 1}`;
    const name = `Organization ${o + 1}`;
    const slug = `org-${o + 1}`;
    console.log(`Building rich org "${name}"…`);

    const org = mustExist(
      await Organization.create({ name, slug, isActive: true, createdBy: superAdmin._id }),
      `organization ${slug}`,
    );

    /* ---- 5a. Teams ---- */
    const teamNames = pickN(
      ["Alpha Team", "Beta Team", "Gamma Team", "Delta Team", "Science Wing", "Language Wing", "Admission Cell", "Content Desk"],
      TEAMS_PER_RICH_ORG,
    );
    const teams = await Team.insertMany(
      teamNames.map((tn) => ({
        organizationId: org._id,
        name: tn,
        description: `${tn} of ${name}.`,
        createdBy: superAdmin._id,
        isActive: chance(0.9),
      })),
    );
    const teamIds = teams.map((t) => t._id as Types.ObjectId);

    /* ---- 5b. Members (distinct users + membership rows) ---- */
    const memberUserIds: Types.ObjectId[] = [];
    const teacherIds: Types.ObjectId[] = [];
    const contentWriterIds: Types.ObjectId[] = [];
    const reviewerIds: Types.ObjectId[] = [];
    let ownerId: Types.ObjectId | null = null;

    const userDocs: Record<string, unknown>[] = [];
    const roleForRow: { org: string; global: string; prefix: string; n: number }[] = [];

    let suspendedBudget = 3;
    let pendingBudget = 2;

    for (const planItem of RICH_ORG_ROLE_PLAN) {
      for (let n = 1; n <= planItem.count; n += 1) {
        const first = pick(FIRST_NAMES);
        const last = pick(LAST_NAMES);
        let status: "active" | "pending" | "suspended" = "active";
        if (planItem.org !== "organization_owner" && suspendedBudget > 0 && chance(0.12)) {
          status = "suspended";
          suspendedBudget -= 1;
        } else if (planItem.org !== "organization_owner" && pendingBudget > 0 && chance(0.1)) {
          status = "pending";
          pendingBudget -= 1;
        }
        const primaryDemoEmail =
          orgKey === "org1" && n === 1
            ? {
                organization_owner: "abdullahakib313@gmail.com",
                teacher: "teacher.abdullah@demo.test",
                reviewer: "reviewer1.org1@autoqgen.test",
              }[planItem.org]
            : undefined;
        userDocs.push({
          name: `${first} ${last}`,
          email: primaryDemoEmail ?? `${planItem.prefix}${n}.${orgKey}@autoqgen.test`,
          password: primaryDemoEmail === "abdullahakib313@gmail.com" ? primaryOwnerPasswordHash : passwordHash,
          role: planItem.global,
          status,
          emailVerified: status === "pending" ? null : daysAgo(int(30, 380)),
          organization: org._id,
          lastLoginAt: status === "active" ? daysAgo(int(0, 40)) : null,
        });
        roleForRow.push({ org: planItem.org, global: planItem.global, prefix: planItem.prefix, n });
      }
    }

    const members = await User.insertMany(userDocs);
    const memberDocs: Record<string, unknown>[] = [];
    members.forEach((u, idx) => {
      const uid = u._id as Types.ObjectId;
      const meta = roleForRow[idx]!;
      memberUserIds.push(uid);
      allUserIds.push(uid);
      if (meta.org === "organization_owner") ownerId = uid;
      if (meta.org === "teacher") teacherIds.push(uid);
      if (meta.org === "content_writer") contentWriterIds.push(uid);
      if (meta.org === "reviewer") reviewerIds.push(uid);

      const onTeam = meta.org === "organization_owner" ? false : chance(0.6);
      memberDocs.push({
        userId: uid,
        organizationId: org._id,
        role: meta.org,
        teamId: onTeam ? pick(teamIds) : null,
        status: (u as { status: string }).status === "suspended" ? "suspended" : "active",
        invitedBy: meta.org === "organization_owner" ? superAdmin._id : ownerId ?? superAdmin._id,
        joinedAt: daysAgo(int(20, 360)),
      });
    });
    await OrganizationMember.insertMany(memberDocs);
    const resolvedOwnerId = mustExist(ownerId, `owner for ${slug}`);
    await Organization.updateOne({ _id: org._id }, { $set: { owner: resolvedOwnerId } }).exec();

    const authorPool = [...teacherIds, ...contentWriterIds];

    /* ---- 5c. Invitations ---- */
    const inviteDocs: Record<string, unknown>[] = [];
    for (let n = 1; n <= PENDING_INVITES_PER_RICH_ORG; n += 1) {
      inviteDocs.push({
        organizationId: org._id,
        email: `invitee${n}.${orgKey}@autoqgen.test`,
        role: pick(["team_admin", "teacher", "content_writer", "reviewer", "moderator", "student", "member"]),
        teamId: chance(0.4) ? pick(teamIds) : null,
        invitedBy: resolvedOwnerId,
        tokenHash: sha256(`seed-large::${slug}::pending::${n}`),
        status: "pending",
        expiresAt: new Date(NOW + int(2, 20) * DAY_MS),
      });
    }
    const closedStatuses = ["accepted", "rejected", "expired", "cancelled"] as const;
    for (let n = 1; n <= CLOSED_INVITES_PER_RICH_ORG; n += 1) {
      const status = closedStatuses[n % closedStatuses.length]!;
      inviteDocs.push({
        organizationId: org._id,
        email: `former${n}.${orgKey}@autoqgen.test`,
        role: pick(["teacher", "reviewer", "member"]),
        teamId: null,
        invitedBy: resolvedOwnerId,
        tokenHash: sha256(`seed-large::${slug}::closed::${n}`),
        status,
        expiresAt: new Date(NOW - int(1, 30) * DAY_MS),
        acceptedAt: status === "accepted" ? daysAgo(int(5, 60)) : null,
        rejectedAt: status === "rejected" ? daysAgo(int(5, 60)) : null,
      });
    }
    await OrganizationInvitation.insertMany(inviteDocs);

    /* ---- 5d. Taxonomy: category → subject → chapter → topic ---- */
    const categoryNames = pickN(CATEGORY_NAME_POOL, CATEGORIES_PER_RICH_ORG);
    const catDocs = categoryNames.map((cn, i) => ({
      organizationId: org._id,
      name: cn,
      slug: slugify(cn),
      description: `${cn} curriculum for ${name}.`,
      order: i + 1,
      isActive: chance(0.9),
      createdBy: resolvedOwnerId,
    }));
    const categories = await Category.insertMany(catDocs);

    const subjectDocs: Record<string, unknown>[] = [];
    const subjectParent: { categoryId: Types.ObjectId }[] = [];
    for (const cat of categories) {
      const subjectNames = pickN(SUBJECT_NAME_POOL, int(SUBJECTS_PER_CATEGORY[0], SUBJECTS_PER_CATEGORY[1]));
      subjectNames.forEach((sn, i) => {
        subjectDocs.push({
          organizationId: org._id,
          name: sn,
          slug: slugify(sn),
          code: sn.slice(0, 3).toUpperCase(),
          category: cat._id,
          classLevel: (cat as { name: string }).name,
          group: pick(["Science", "Commerce", "Arts", "General"]),
          order: i + 1,
          isActive: chance(0.92),
          createdBy: resolvedOwnerId,
        });
        subjectParent.push({ categoryId: cat._id as Types.ObjectId });
      });
    }
    const subjects = await Subject.insertMany(subjectDocs);

    const chapterDocs: Record<string, unknown>[] = [];
    const chapterParent: { categoryId: Types.ObjectId; subjectId: Types.ObjectId }[] = [];
    subjects.forEach((sub, si) => {
      const parent = subjectParent[si]!;
      const chapterCount = int(CHAPTERS_PER_SUBJECT[0], CHAPTERS_PER_SUBJECT[1]);
      for (let c = 1; c <= chapterCount; c += 1) {
        const title = `${pick(CHAPTER_TOPIC_WORDS)} ${c}`;
        chapterDocs.push({
          organizationId: org._id,
          name: `Ch ${c}: ${title}`,
          slug: slugify(`${(sub as { slug: string }).slug}-ch-${c}-${title}`),
          chapterNo: c,
          description: "",
          category: parent.categoryId,
          subject: sub._id,
          order: c,
          isActive: chance(0.94),
          createdBy: resolvedOwnerId,
        });
        chapterParent.push({ categoryId: parent.categoryId, subjectId: sub._id as Types.ObjectId });
      }
    });
    const chapters = await Chapter.insertMany(chapterDocs);

    const topicDocs: Record<string, unknown>[] = [];
    chapters.forEach((chap, ci) => {
      const parent = chapterParent[ci]!;
      const topicCount = int(TOPICS_PER_CHAPTER[0], TOPICS_PER_CHAPTER[1]);
      for (let t = 1; t <= topicCount; t += 1) {
        const tw = pick(CHAPTER_TOPIC_WORDS);
        topicDocs.push({
          organizationId: org._id,
          name: `${tw} ${t}`,
          slug: slugify(`${(chap as { slug: string }).slug}-topic-${t}-${tw}`),
          description: "",
          category: parent.categoryId,
          subject: parent.subjectId,
          chapter: chap._id,
          order: t,
          isActive: chance(0.95),
          createdBy: resolvedOwnerId,
        });
      }
    });
    await Topic.insertMany(topicDocs);

    /* Flat lookup: chapter → one of its topic ids (re-queried, since the docs
       above were inserted as plain objects and we need the generated ids). */
    const topicsByChapter = new Map<string, Types.ObjectId>();
    const insertedTopics = await Topic.find({ organizationId: org._id }).select("_id chapter").lean().exec();
    for (const it of insertedTopics) {
      const key = it.chapter.toString();
      if (!topicsByChapter.has(key)) topicsByChapter.set(key, it._id);
    }

    const chapterCtx = chapters.map((chap, ci) => ({
      chapterId: chap._id as Types.ObjectId,
      categoryId: chapterParent[ci]!.categoryId,
      subjectId: chapterParent[ci]!.subjectId,
      chapterName: (chap as { name: string }).name,
      topicId: topicsByChapter.get((chap._id as Types.ObjectId).toString()) ?? null,
    }));

    /* ---- 5e. Questions — every type, difficulty, status, language ---- */
    const questionChapters = chapterCtx.slice(0, Math.min(chapterCtx.length, HOT_CHAPTERS_PER_RICH_ORG));
    const questionDocs: Record<string, unknown>[] = [];
    for (let i = 0; i < QUESTIONS_PER_RICH_ORG; i += 1) {
      const ctx = questionChapters[i % questionChapters.length]!;
      const type = QUESTION_TYPE_POOL[i % QUESTION_TYPE_POOL.length]!;
      const difficulty = DIFFICULTY_POOL[i % DIFFICULTY_POOL.length]!;
      const statusRoll = rnd();
      const status =
        statusRoll < 0.55 ? "APPROVED" : statusRoll < 0.8 ? "PENDING" : statusRoll < 0.92 ? "DRAFT" : "REJECTED";
      const language = i % 2 === 0 ? "en" : "bn";
      const aiGenerated = chance(0.35);
      const author = pick(authorPool);
      const text = `[${slug} #${i + 1}] ${ctx.chapterName} — ${type} (${difficulty}) practice item`;

      const base: Record<string, unknown> = {
        organizationId: org._id,
        category: ctx.categoryId,
        subject: ctx.subjectId,
        chapter: ctx.chapterId,
        topic: ctx.topicId,
        board: chance(0.7) ? pick(boardIds) : null,
        exam: status === "APPROVED" && chance(0.6) ? pick(examIds) : null,
        type,
        difficulty,
        language,
        question: { text },
        options: [],
        answer: { text: "", correctOptions: [], booleanAnswer: null, matchingPairs: [] },
        explanation: chance(0.6) ? `Worked explanation for item ${i + 1}.` : "",
        contentHash: questionContentHash(ctx.chapterId.toString(), text),
        source: pick(SOURCE_POOL),
        session: pick(SESSION_POOL),
        year: chance(0.7) ? int(2015, 2025) : null,
        marks: type === "WRITTEN" ? int(3, 10) : type === "SHORT" ? int(2, 4) : 1,
        estimatedTime: type === "WRITTEN" ? int(300, 900) : int(45, 180),
        tags: ["seed", slug, ...pickN(TAG_POOL, int(1, 3))],
        aiGenerated,
        status,
        isActive: status !== "REJECTED" || chance(0.5),
        createdBy: author,
        updatedBy: chance(0.3) ? pick(authorPool) : null,
        approvedBy: status === "APPROVED" ? pick(reviewerIds) : null,
        approvedAt: status === "APPROVED" ? daysAgo(int(1, 120)) : null,
        reviewNote: status === "REJECTED" ? pick(["Ambiguous stem.", "Duplicate of an existing item.", "Answer key wrong."]) : "",
      };

      const letters = ["A", "B", "C", "D", "E"];
      if (type === "MCQ" || type === "ASSERTION_REASON") {
        base.options = letters.slice(0, 4).map((id) => ({ id, text: `Option ${id}`, image: "", explanation: "" }));
        (base.answer as Record<string, unknown>).correctOptions = [pick(letters.slice(0, 4))];
      } else if (type === "MULTIPLE_CORRECT") {
        base.options = letters.slice(0, 5).map((id) => ({ id, text: `Option ${id}`, image: "", explanation: "" }));
        (base.answer as Record<string, unknown>).correctOptions = pickN(letters.slice(0, 5), int(2, 3));
      } else if (type === "TRUE_FALSE") {
        (base.answer as Record<string, unknown>).booleanAnswer = chance(0.5);
      } else if (type === "MATCHING") {
        (base.answer as Record<string, unknown>).matchingPairs = [
          { left: "Term 1", right: "Definition 1" },
          { left: "Term 2", right: "Definition 2" },
          { left: "Term 3", right: "Definition 3" },
        ];
      } else if (type === "IMAGE") {
        (base.question as Record<string, unknown>).image = `https://cdn.autoqgen.test/seed/${slug}/q${i + 1}.png`;
        (base.answer as Record<string, unknown>).text = "See labelled diagram.";
      } else if (type === "PASSAGE") {
        (base.question as Record<string, unknown>).passage =
          "Read the following passage and answer the question that follows. " +
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.";
        (base.answer as Record<string, unknown>).text = "Answer grounded in the passage.";
      } else {
        // SHORT, WRITTEN, FILL_BLANK
        (base.answer as Record<string, unknown>).text =
          type === "FILL_BLANK" ? "keyword" : `Model answer for item ${i + 1}.`;
      }

      questionDocs.push(base);
    }
    const insertedQuestions = await Question.insertMany(questionDocs);
    const approvedQ = insertedQuestions
      .filter((q) => (q as { status: string; isActive: boolean }).status === "APPROVED" && (q as { isActive: boolean }).isActive)
      .map((q) => ({
        id: q._id as Types.ObjectId,
        subject: (q as { subject: Types.ObjectId }).subject,
        category: (q as { category: Types.ObjectId }).category,
        chapter: (q as { chapter: Types.ObjectId }).chapter,
        marks: (q as { marks: number }).marks,
        type: (q as { type: string }).type,
        difficulty: (q as { difficulty: string | null }).difficulty,
      }));

    /* ---- 5f. Question papers — MANUAL + AUTO, every status ---- */
    const bySubject = new Map<string, typeof approvedQ>();
    for (const q of approvedQ) {
      const k = q.subject.toString();
      if (!bySubject.has(k)) bySubject.set(k, []);
      bySubject.get(k)!.push(q);
    }
    const subjectKeysWithEnough = [...bySubject.entries()].filter(([, v]) => v.length >= 4);

    const paperStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
    const createdPaperIds: Types.ObjectId[] = [];
    for (let p = 0; p < PAPERS_PER_RICH_ORG && subjectKeysWithEnough.length > 0; p += 1) {
      const entry = subjectKeysWithEnough[p % subjectKeysWithEnough.length]!;
      const [subjectKey, pool] = entry;
      const chosen = pickN(pool, Math.min(pool.length, int(6, 16)));
      const subjectId = new Types.ObjectId(subjectKey);
      const categoryId = chosen[0]!.category;
      const mode = chance(0.5) ? "AUTO" : "MANUAL";
      const status = paperStatuses[p % paperStatuses.length]!;
      const isPublished = status === "PUBLISHED";
      const isArchived = status === "ARCHIVED";

      const half = Math.ceil(chosen.length / 2);
      const sections =
        chance(0.5) && chosen.length >= 4
          ? [
              {
                title: "Section A — Objective",
                instructions: "Answer all questions.",
                order: 0,
                questions: chosen.slice(0, half).map((q, idx) => ({ question: q.id, order: idx, marks: q.marks, note: "" })),
              },
              {
                title: "Section B — Written",
                instructions: "Answer any two.",
                order: 1,
                questions: chosen.slice(half).map((q, idx) => ({ question: q.id, order: idx, marks: q.marks, note: "" })),
              },
            ]
          : [
              {
                title: "Section A",
                instructions: "",
                order: 0,
                questions: chosen.map((q, idx) => ({ question: q.id, order: idx, marks: q.marks, note: "" })),
              },
            ];
      const totalMarks = sections.reduce((s, sec) => s + sec.questions.reduce((a, q) => a + q.marks, 0), 0);
      const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);
      const creator = pick(authorPool);

      const paper = await QuestionPaper.create({
        organizationId: org._id,
        title: `${name} — Paper ${p + 1} (${mode})`,
        description: `Auto-seeded ${mode.toLowerCase()} paper #${p + 1}.`,
        instructions: "Write your roll number on top of every page.",
        category: categoryId,
        subject: subjectId,
        board: pick(boardIds),
        exam: pick(examIds),
        year: int(2021, 2025),
        mode,
        status,
        durationMinutes: pick([60, 90, 120, 150, 180]),
        totalMarks,
        totalQuestions,
        sections,
        generationSpec:
          mode === "AUTO"
            ? {
                chapters: [...new Set(chosen.map((q) => q.chapter.toString()))].map((c) => new Types.ObjectId(c)),
                topics: [],
                totalQuestions,
                totalMarks,
                difficultyDistribution: [
                  { difficulty: "EASY", count: Math.round(totalQuestions * 0.4) },
                  { difficulty: "MEDIUM", count: Math.round(totalQuestions * 0.4) },
                  { difficulty: "HARD", count: Math.round(totalQuestions * 0.2) },
                ],
                typeDistribution: [{ type: "MCQ", count: Math.round(totalQuestions * 0.5) }],
                language: chance(0.5) ? "en" : "bn",
                seed: sha256(`seed-large::${slug}::paper::${p}`).slice(0, 16),
              }
            : null,
        clonedFrom: p > 0 && chance(0.25) && createdPaperIds.length > 0 ? pick(createdPaperIds) : null,
        createdBy: creator,
        updatedBy: null,
        publishedBy: isPublished ? resolvedOwnerId : null,
        publishedAt: isPublished ? daysAgo(int(1, 40)) : null,
        archivedAt: isArchived ? daysAgo(int(1, 40)) : null,
        isActive: true,
      });
      createdPaperIds.push(paper._id as Types.ObjectId);
    }

    console.log(
      `  members=${memberUserIds.length} teams=${teamIds.length} categories=${categories.length} ` +
        `subjects=${subjects.length} chapters=${chapters.length} questions=${insertedQuestions.length} ` +
        `papers=${createdPaperIds.length} invitations=${inviteDocs.length}`,
    );

    richOrgs.push({
      id: org._id as Types.ObjectId,
      name,
      slug,
      orgKey,
      ownerId: resolvedOwnerId,
      memberUserIds,
      teacherIds,
      reviewerIds,
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  6. Shell organizations — volume for the admin Organizations list    */
  /* ---------------------------------------------------------------------- */

  console.log(`\nBuilding ${SHELL_ORGS} shell organizations…`);
  for (let s = 0; s < SHELL_ORGS; s += 1) {
    // Generic placeholder identities, numbered after the rich orgs.
    const shellKey = `org${RICH_ORGS + s + 1}`;
    const name = `Organization ${RICH_ORGS + s + 1}`;
    const slug = `org-${RICH_ORGS + s + 1}`;
    const org = mustExist(
      await Organization.create({
        name,
        slug,
        isActive: chance(0.85),
        createdBy: superAdmin._id,
      }),
      `shell organization ${slug}`,
    );

    const shellUsers = await User.insertMany(
      Array.from({ length: 3 }, (_, i) => ({
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        email: `member${i + 1}.${shellKey}@autoqgen.test`,
        password: passwordHash,
        role: i === 0 ? "organization_owner" : pick(["teacher", "reviewer"]),
        status: "active",
        emailVerified: daysAgo(int(10, 200)),
        organization: org._id,
        lastLoginAt: daysAgo(int(0, 30)),
      })),
    );
    const shellOwnerId = shellUsers[0]!._id as Types.ObjectId;
    for (const u of shellUsers) allUserIds.push(u._id as Types.ObjectId);

    await OrganizationMember.insertMany(
      shellUsers.map((u, i) => ({
        userId: u._id,
        organizationId: org._id,
        role: i === 0 ? "organization_owner" : (u as { role: string }).role,
        teamId: null,
        status: "active",
        invitedBy: i === 0 ? superAdmin._id : shellOwnerId,
        joinedAt: daysAgo(int(10, 200)),
      })),
    );
    await Organization.updateOne({ _id: org._id }, { $set: { owner: shellOwnerId } }).exec();

    const shellCats = await Category.insertMany(
      pickN(CATEGORY_NAME_POOL, 3).map((cn, i) => ({
        organizationId: org._id,
        name: cn,
        slug: slugify(cn),
        description: `${cn} — ${name}.`,
        order: i + 1,
        isActive: true,
        createdBy: shellOwnerId,
      })),
    );
    await Subject.insertMany(
      shellCats.flatMap((cat) =>
        pickN(SUBJECT_NAME_POOL, 2).map((sn, i) => ({
          organizationId: org._id,
          name: sn,
          slug: slugify(sn),
          code: sn.slice(0, 3).toUpperCase(),
          category: cat._id,
          classLevel: (cat as { name: string }).name,
          group: "General",
          order: i + 1,
          isActive: true,
          createdBy: shellOwnerId,
        })),
      ),
    );

    // One pending invitation each, so the admin drill-down has something to show.
    await OrganizationInvitation.create({
      organizationId: org._id,
      email: `pending.${shellKey}@autoqgen.test`,
      role: "teacher",
      teamId: null,
      invitedBy: shellOwnerId,
      tokenHash: sha256(`seed-large::${slug}::shell-invite`),
      status: "pending",
      expiresAt: new Date(NOW + 14 * DAY_MS),
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  7. Audit log — every action, spread across 90 days                  */
  /* ---------------------------------------------------------------------- */

  console.log(`\nWriting ${AUDIT_LOGS} audit-log entries…`);
  const auditDocs = Array.from({ length: AUDIT_LOGS }, () => {
    const action = pick(AUDIT_ACTION_POOL);
    const actor = chance(0.95) ? pick(allUserIds) : null;
    const outcome = chance(0.9) ? "success" : "failure";
    return {
      action,
      actor,
      actorRole: actor ? pick(["super_admin", "organization_owner", "teacher", "reviewer", "moderator"]) : "anonymous",
      resourceType: resourceTypeForAction(action),
      resourceId: chance(0.8) ? new Types.ObjectId().toString() : "",
      metadata: chance(0.7) ? { note: "seed", ip_country: pick(["BD", "IN", "GB", "US"]) } : {},
      requestId: sha256(`${action}-${rnd()}`).slice(0, 16),
      ip: `${int(1, 223)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
      outcome,
      createdAt: daysAgo(int(0, 90)),
    };
  });
  await AuditLog.insertMany(auditDocs);

  /* ---------------------------------------------------------------------- */
  /*  8. Password reset tokens (active + spent)                           */
  /* ---------------------------------------------------------------------- */

  const resetDocs = Array.from({ length: RESET_TOKENS }, (_, i) => {
    const used = i % 2 === 0;
    return {
      userId: pick(allUserIds),
      tokenHash: sha256(`seed-large::reset::${i}`),
      expiresAt: new Date(NOW + (used ? -DAY_MS : 3_600_000)),
      usedAt: used ? daysAgo(int(1, 10)) : null,
      requestedIp: `${int(1, 223)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
    };
  });
  await PasswordResetToken.insertMany(resetDocs);

  /* ---------------------------------------------------------------------- */
  /*  9. Summary                                                          */
  /* ---------------------------------------------------------------------- */

  const counts = {
    Organizations: await Organization.countDocuments({}),
    Users: await User.countDocuments({}),
    OrganizationMembers: await OrganizationMember.countDocuments({}),
    OrganizationInvitations: await OrganizationInvitation.countDocuments({}),
    Teams: await Team.countDocuments({}),
    Categories: await Category.countDocuments({}),
    Subjects: await Subject.countDocuments({}),
    Chapters: await Chapter.countDocuments({}),
    Topics: await Topic.countDocuments({}),
    Questions: await Question.countDocuments({}),
    QuestionPapers: await QuestionPaper.countDocuments({}),
    Boards: await Board.countDocuments({}),
    Exams: await Exam.countDocuments({}),
    AuditLogs: await AuditLog.countDocuments({}),
    PasswordResetTokens: await PasswordResetToken.countDocuments({}),
  };

  console.log("\n────────────────────────── seed:large complete ──────────────────────────");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }
  console.log("\n  Every list view above the 20-row page size now paginates.");
  console.log("\n  All accounts share the password:");
  console.log(`      ${PASSWORD}`);
  console.log("\n  Platform Super Admins (no organization):");
  console.log("      superadmin@demo.test");
  console.log("      admin2@autoqgen.test");
  for (const org of richOrgs) {
    console.log(`\n  ${org.name}:`);
    if (org.orgKey === "org1") {
      console.log("      owner:    abdullahakib313@gmail.com");
      console.log("      teacher:  teacher.abdullah@demo.test");
      console.log("      reviewer: reviewer1.org1@autoqgen.test");
    } else {
      console.log(`      owner:    owner1.${org.orgKey}@autoqgen.test`);
      console.log(`      teacher:  teacher1.${org.orgKey}@autoqgen.test`);
      console.log(`      reviewer: reviewer1.${org.orgKey}@autoqgen.test`);
    }
  }
  console.log("────────────────────────────────────────────────────────────────────────\n");

  await disconnectDB();
}

main().catch((error: unknown) => {
  console.error("\nseed:large failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
