/* eslint-disable no-console */
import { loadEnvFiles } from "./load-env";

loadEnvFiles();

/**
 * Development seed.
 *
 * Refuses to run when NODE_ENV=production. Credentials come from SEED_PASSWORD
 * (defaulting to a well-known development value) and are printed once so they
 * can be used immediately — they are development-only by construction and must
 * never exist in a deployed environment.
 *
 * Idempotent: every write is an upsert keyed on a natural unique field, so the
 * script can be re-run safely.
 */

/** Mongoose types findOneAndUpdate as nullable even with upsert:true. */
function mustExist<T>(value: T | null, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Seed failed: ${what} was not created.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The seed script must not be run against a production database.");
  }

  // Imported after env loading so config validation sees the values.
  const { connectDB, disconnectDB } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/auth/password");
  const { questionContentHash } = await import("@/lib/security/hash");
  const { User, Category, Subject, Chapter, Topic, Board, Exam, Question } = await import(
    "@/models"
  );

  const seedPassword = process.env.SEED_PASSWORD ?? "DevPassword123!";

  await connectDB();
  console.log("Connected. Seeding development data…");

  /* --------------------------------- Users --------------------------------- */

  const passwordHash = await hashPassword(seedPassword);

  const userSpecs = [
    { name: "Ada Admin", email: "admin@autoqgen.local", role: "super_admin" as const },
    { name: "Tara Teacher", email: "teacher@autoqgen.local", role: "teacher" as const },
    { name: "Riaz Reviewer", email: "reviewer@autoqgen.local", role: "reviewer" as const },
    { name: "Sami Student", email: "student@autoqgen.local", role: "student" as const },
  ];

  const users = new Map<string, string>();

  for (const spec of userSpecs) {
    const user = mustExist(
      await User.findOneAndUpdate(
        { email: spec.email },
        {
          $set: {
            name: spec.name,
            role: spec.role,
            status: "active",
            emailVerified: new Date(),
          },
          $setOnInsert: { password: passwordHash },
        },
        { upsert: true, new: true },
      ).exec(),
      `user ${spec.email}`,
    );

    users.set(spec.role, user._id.toString());
  }

  const teacherId = mustExist(users.get("teacher") ?? null, "teacher id");

  /* -------------------------------- Taxonomy -------------------------------- */

  const category = mustExist(
    await Category.findOneAndUpdate(
      { slug: "class-9-10" },
      {
        $set: {
          name: "Class 9-10",
          description: "Secondary curriculum",
          order: 1,
          isActive: true,
        },
      },
      { upsert: true, new: true },
    ).exec(),
    "category Class 9-10",
  );

  async function upsertSubject(name: string, slug: string) {
    return mustExist(
      await Subject.findOneAndUpdate(
        { category: category._id, slug },
        { $set: { name, category: category._id, group: "Science", classLevel: "Class 9-10" } },
        { upsert: true, new: true },
      ).exec(),
      `subject ${slug}`,
    );
  }

  const physics = await upsertSubject("Physics", "physics");
  const chemistry = await upsertSubject("Chemistry", "chemistry");

  async function upsertChapter(
    subjectId: typeof physics._id,
    name: string,
    slug: string,
    chapterNo: number,
  ) {
    return mustExist(
      await Chapter.findOneAndUpdate(
        { subject: subjectId, slug },
        { $set: { name, chapterNo, category: category._id, subject: subjectId } },
        { upsert: true, new: true },
      ).exec(),
      `chapter ${slug}`,
    );
  }

  const motion = await upsertChapter(physics._id, "Motion", "motion", 2);
  const force = await upsertChapter(physics._id, "Force", "force", 3);
  const matter = await upsertChapter(chemistry._id, "States of Matter", "states-of-matter", 1);

  async function upsertTopic(
    chapterId: typeof motion._id,
    subjectId: typeof physics._id,
    name: string,
    slug: string,
  ) {
    return mustExist(
      await Topic.findOneAndUpdate(
        { chapter: chapterId, slug },
        { $set: { name, category: category._id, subject: subjectId, chapter: chapterId } },
        { upsert: true, new: true },
      ).exec(),
      `topic ${slug}`,
    );
  }

  await upsertTopic(motion._id, physics._id, "Velocity and Acceleration", "velocity-acceleration");
  await upsertTopic(force._id, physics._id, "Newton's Laws", "newtons-laws");
  await upsertTopic(matter._id, chemistry._id, "Diffusion", "diffusion");

  const board = mustExist(
    await Board.findOneAndUpdate(
      { slug: "dhaka-board" },
      { $set: { name: "Dhaka Board", shortName: "DB", country: "Bangladesh" } },
      { upsert: true, new: true },
    ).exec(),
    "board dhaka-board",
  );

  const exam = mustExist(
    await Exam.findOneAndUpdate(
      { slug: "ssc-2024", year: 2024, board: board._id },
      {
        $set: {
          name: "SSC 2024",
          type: "SSC",
          category: category._id,
          board: board._id,
          year: 2024,
        },
      },
      { upsert: true, new: true },
    ).exec(),
    "exam ssc-2024",
  );

  /* -------------------------------- Questions ------------------------------- */

  interface SeedQuestion {
    chapter: typeof motion._id;
    subject: typeof physics._id;
    type: string;
    text: string;
    options?: { id: string; text: string }[];
    answer: {
      text?: string;
      correctOptions?: string[];
      booleanAnswer?: boolean | null;
      matchingPairs?: { left: string; right: string }[];
    };
    difficulty: string;
    status: string;
  }

  const seedQuestions: SeedQuestion[] = [
    {
      chapter: motion._id,
      subject: physics._id,
      type: "MCQ",
      text: "What is the SI unit of acceleration?",
      options: [
        { id: "A", text: "m/s" },
        { id: "B", text: "m/s²" },
        { id: "C", text: "N" },
        { id: "D", text: "J" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      chapter: motion._id,
      subject: physics._id,
      type: "TRUE_FALSE",
      text: "A body moving with constant velocity has zero acceleration.",
      answer: { booleanAnswer: true },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      chapter: force._id,
      subject: physics._id,
      type: "MULTIPLE_CORRECT",
      text: "Which of the following are contact forces?",
      options: [
        { id: "A", text: "Friction" },
        { id: "B", text: "Gravity" },
        { id: "C", text: "Normal reaction" },
        { id: "D", text: "Magnetic force" },
      ],
      answer: { correctOptions: ["A", "C"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      chapter: force._id,
      subject: physics._id,
      type: "SHORT",
      text: "State Newton's second law of motion.",
      answer: { text: "Force equals the rate of change of momentum; F = ma for constant mass." },
      difficulty: "MEDIUM",
      status: "PENDING",
    },
    {
      chapter: force._id,
      subject: physics._id,
      type: "WRITTEN",
      text: "Explain why a passenger lurches forward when a moving bus stops suddenly.",
      answer: {
        text: "Inertia keeps the upper body moving while the bus and the passenger's feet decelerate.",
      },
      difficulty: "HARD",
      status: "DRAFT",
    },
    {
      chapter: matter._id,
      subject: chemistry._id,
      type: "FILL_BLANK",
      text: "Particles spreading from a region of high concentration to low concentration is called ______.",
      answer: { text: "diffusion" },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      chapter: matter._id,
      subject: chemistry._id,
      type: "MATCHING",
      text: "Match each state of matter with its property.",
      answer: {
        matchingPairs: [
          { left: "Solid", right: "Fixed shape and volume" },
          { left: "Liquid", right: "Fixed volume, takes the shape of its container" },
          { left: "Gas", right: "Neither fixed shape nor fixed volume" },
        ],
      },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      chapter: matter._id,
      subject: chemistry._id,
      type: "ASSERTION_REASON",
      text: "Assertion: gases are highly compressible. Reason: intermolecular spacing in a gas is large.",
      options: [
        { id: "A", text: "Both true, reason explains assertion" },
        { id: "B", text: "Both true, reason does not explain assertion" },
        { id: "C", text: "Assertion true, reason false" },
        { id: "D", text: "Assertion false, reason true" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "HARD",
      status: "APPROVED",
    },
  ];

  let inserted = 0;

  for (const item of seedQuestions) {
    const contentHash = questionContentHash(item.chapter.toString(), item.text);

    const result = await Question.updateOne(
      { chapter: item.chapter, contentHash },
      {
        $set: {
          category: category._id,
          subject: item.subject,
          chapter: item.chapter,
          board: board._id,
          exam: exam._id,
          type: item.type,
          difficulty: item.difficulty,
          language: "en",
          question: { text: item.text },
          options: item.options ?? [],
          answer: {
            text: item.answer.text ?? "",
            correctOptions: item.answer.correctOptions ?? [],
            booleanAnswer: item.answer.booleanAnswer ?? null,
            matchingPairs: item.answer.matchingPairs ?? [],
          },
          contentHash,
          marks: 1,
          year: 2024,
          tags: ["seed"],
          status: item.status,
          isActive: true,
          createdBy: teacherId,
        },
      },
      { upsert: true },
    ).exec();

    if (result.upsertedCount > 0) inserted += 1;
  }

  console.log("");
  console.log("Seed complete.");
  console.log(`  Users:      ${userSpecs.length}`);
  console.log("  Categories: 1   Subjects: 2   Chapters: 3   Topics: 3");
  console.log("  Boards:     1   Exams: 1");
  console.log(`  Questions:  ${seedQuestions.length} (${inserted} newly inserted)`);
  console.log("");
  // console.log("DEVELOPMENT-ONLY credentials — never use these outside local development:");
  // for (const spec of userSpecs) {
  //   console.log(`  ${spec.role.padEnd(12)} ${spec.email.padEnd(28)} ${seedPassword}`);
  // }
  console.log("");

  await disconnectDB();
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
