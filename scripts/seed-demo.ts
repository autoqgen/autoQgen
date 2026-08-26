import { loadEnvFiles } from "./load-env";

loadEnvFiles();

/**
 * Demo/testing data for manual QA and stakeholder walkthroughs.
 *
 * Creates one demo organization, one user per role (all named "Abdullah …",
 * password "1234"), a Class 9 category with বাংলা and গণিত subjects, and 20
 * questions per subject spread across chapters/topics/difficulties.
 *
 * Refuses to run when NODE_ENV=production — the "1234" password is fine for a
 * local/demo database only. Idempotent: every write is an upsert keyed on a
 * natural unique field, so the script can be re-run safely without creating
 * duplicates or touching unrelated data.
 */

function mustExist<T>(value: T | null, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Seed failed: ${what} was not created.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo seed script must not be run against a production database.");
  }

  const { connectDB, disconnectDB } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/auth/password");
  const { questionContentHash } = await import("@/lib/security/hash");
  const { User, Organization, Category, Subject, Chapter, Topic, Question } = await import(
    "@/models"
  );
  const { USER_ROLES } = await import("@/types/roles");

  const DEMO_PASSWORD = "1234";

  await connectDB();
  console.log("Connected. Seeding demo data…");

  /* ------------------------------ Organization ------------------------------ */

  const org = mustExist(
    await Organization.findOneAndUpdate(
      { slug: "abdullah-demo-organization" },
      { $set: { name: "Abdullah Demo Organization", isActive: true } },
      { upsert: true, new: true },
    ).exec(),
    "organization Abdullah Demo Organization",
  );

  /* --------------------------------- Users ---------------------------------- */

  const roleLabels: Record<(typeof USER_ROLES)[number], string> = {
    super_admin: "Super Admin",
    organization_owner: "Organization Owner",
    team_admin: "Team Admin",
    teacher: "Teacher",
    content_writer: "Content Writer",
    reviewer: "Reviewer",
    moderator: "Moderator",
    student: "Student",
  };

  const emailSlugs: Record<(typeof USER_ROLES)[number], string> = {
    super_admin: "superadmin",
    organization_owner: "orgowner",
    team_admin: "teamadmin",
    teacher: "teacher",
    content_writer: "contentwriter",
    reviewer: "reviewer",
    moderator: "moderator",
    student: "student",
  };

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = new Map<(typeof USER_ROLES)[number], string>();

  for (const role of USER_ROLES) {
    const name = `Abdullah ${roleLabels[role]}`;
    const email = `abdullah.${emailSlugs[role]}@demo.com`;

    const user = mustExist(
      await User.findOneAndUpdate(
        { email },
        {
          $set: {
            name,
            role,
            status: "active",
            emailVerified: new Date(),
            organization: org._id,
          },
          $setOnInsert: { password: passwordHash },
        },
        { upsert: true, new: true },
      ).exec(),
      `user ${email}`,
    );

    users.set(role, user._id.toString());
  }

  await Organization.updateOne(
    { _id: org._id },
    { $set: { owner: users.get("organization_owner") } },
  ).exec();

  const contentWriterId = mustExist(users.get("content_writer") ?? null, "content_writer id");
  const reviewerId = mustExist(users.get("reviewer") ?? null, "reviewer id");

  /* -------------------------------- Taxonomy -------------------------------- */

  const category = mustExist(
    await Category.findOneAndUpdate(
      { slug: "class-9" },
      {
        $set: {
          name: "Class 9",
          description: "নবম শ্রেণির ডেমো প্রশ্নভাণ্ডার — বাংলা ও গণিত",
          order: 1,
          isActive: true,
          createdBy: users.get("super_admin"),
        },
      },
      { upsert: true, new: true },
    ).exec(),
    "category Class 9",
  );

  async function upsertSubject(name: string, slug: string) {
    return mustExist(
      await Subject.findOneAndUpdate(
        { category: category._id, slug },
        {
          $set: {
            name,
            category: category._id,
            classLevel: "Class 9",
            group: "Compulsory",
            createdBy: users.get("super_admin"),
          },
        },
        { upsert: true, new: true },
      ).exec(),
      `subject ${slug}`,
    );
  }

  const bangla = await upsertSubject("বাংলা", "bangla");
  const math = await upsertSubject("গণিত", "math");

  interface TopicSpec {
    key: string;
    name: string;
    slug: string;
  }
  interface ChapterSpec {
    key: string;
    name: string;
    slug: string;
    chapterNo: number;
    topics: TopicSpec[];
  }

  const banglaChapters: ChapterSpec[] = [
    {
      key: "bn-grammar",
      name: "বাংলা ব্যাকরণ",
      slug: "bangla-grammar",
      chapterNo: 1,
      topics: [
        { key: "bn-dhoni-o-borno", name: "ধ্বনি ও বর্ণ", slug: "dhoni-o-borno" },
        { key: "bn-shobdo-utpotti", name: "শব্দের উৎপত্তিগত শ্রেণিবিভাগ", slug: "shobdo-utpotti" },
        { key: "bn-shomash", name: "সমাস", slug: "shomash" },
        { key: "bn-sondhi", name: "সন্ধি", slug: "sondhi" },
        { key: "bn-karok-o-bivokti", name: "কারক ও বিভক্তি", slug: "karok-o-bivokti" },
        { key: "bn-bachyo-o-prottoy", name: "বাচ্য ও প্রত্যয়", slug: "bachyo-o-prottoy" },
        { key: "bn-ek-kothay-prokash", name: "এক কথায় প্রকাশ", slug: "ek-kothay-prokash" },
      ],
    },
    {
      key: "bn-lit",
      name: "সাহিত্য পরিচিতি",
      slug: "sahitya-parichiti",
      chapterNo: 2,
      topics: [
        { key: "bn-kobi-porichiti", name: "কবি ও সাহিত্যিক পরিচিতি", slug: "kobi-shahityik-porichiti" },
        { key: "bn-kabyagrontho", name: "কাব্যগ্রন্থ ও মহাকাব্য", slug: "kabyagrontho-o-mohakabbo" },
      ],
    },
    {
      key: "bn-prose",
      name: "গদ্য ও পদ্য পাঠ",
      slug: "godyo-o-podyo-path",
      chapterNo: 3,
      topics: [{ key: "bn-chotogolpo", name: "ছোটগল্প পাঠ", slug: "chotogolpo-path" }],
    },
  ];

  const mathChapters: ChapterSpec[] = [
    {
      key: "mt-algebra",
      name: "বীজগণিত",
      slug: "biggonit",
      chapterNo: 1,
      topics: [
        { key: "mt-rashir-utpadok", name: "রাশির উৎপাদকীকরণ", slug: "rashir-utpadok" },
        { key: "mt-somikoron", name: "সরল ও দ্বিঘাত সমীকরণ", slug: "soroj-somikoron" },
        { key: "mt-log", name: "সূচক ও লগারিদম", slug: "suchok-logarithm" },
      ],
    },
    {
      key: "mt-geometry",
      name: "জ্যামিতি",
      slug: "jamiti",
      chapterNo: 2,
      topics: [
        { key: "mt-tribhuj", name: "ত্রিভুজ", slug: "tribhuj" },
        { key: "mt-britto", name: "বৃত্ত", slug: "britto" },
        { key: "mt-kon", name: "কোণ", slug: "kon" },
        { key: "mt-pythagoras", name: "পিথাগোরাসের উপপাদ্য", slug: "pythagoras" },
      ],
    },
    {
      key: "mt-mensuration",
      name: "পরিমিতি",
      slug: "porimiti",
      chapterNo: 3,
      topics: [
        { key: "mt-khetrofol", name: "ক্ষেত্রফল ও পরিসীমা", slug: "khetrofol-porisima" },
        { key: "mt-ghonofol", name: "ঘনফল", slug: "ghonofol" },
      ],
    },
    {
      key: "mt-arithmetic",
      name: "পাটিগণিত",
      slug: "patigonit",
      chapterNo: 4,
      topics: [
        { key: "mt-shotkora", name: "শতকরা", slug: "shotkora" },
        { key: "mt-labh-khoti", name: "লাভ-ক্ষতি", slug: "labh-khoti" },
        { key: "mt-munafa", name: "মুনাফা", slug: "munafa" },
        { key: "mt-moulik-sonkha", name: "মৌলিক সংখ্যা ও গ.সা.গু-ল.সা.গু", slug: "moulik-sonkha" },
      ],
    },
  ];

  const chapterIds = new Map<string, string>();
  const topicIds = new Map<string, string>();

  async function upsertChaptersAndTopics(subjectId: typeof bangla._id, chapters: ChapterSpec[]) {
    for (const chapterSpec of chapters) {
      const chapter = mustExist(
        await Chapter.findOneAndUpdate(
          { subject: subjectId, slug: chapterSpec.slug },
          {
            $set: {
              name: chapterSpec.name,
              chapterNo: chapterSpec.chapterNo,
              category: category._id,
              subject: subjectId,
              createdBy: contentWriterId,
            },
          },
          { upsert: true, new: true },
        ).exec(),
        `chapter ${chapterSpec.slug}`,
      );
      chapterIds.set(chapterSpec.key, chapter._id.toString());

      for (const topicSpec of chapterSpec.topics) {
        const topic = mustExist(
          await Topic.findOneAndUpdate(
            { chapter: chapter._id, slug: topicSpec.slug },
            {
              $set: {
                name: topicSpec.name,
                category: category._id,
                subject: subjectId,
                chapter: chapter._id,
                createdBy: contentWriterId,
              },
            },
            { upsert: true, new: true },
          ).exec(),
          `topic ${topicSpec.slug}`,
        );
        topicIds.set(topicSpec.key, topic._id.toString());
      }
    }
  }

  await upsertChaptersAndTopics(bangla._id, banglaChapters);
  await upsertChaptersAndTopics(math._id, mathChapters);

  /* -------------------------------- Questions ------------------------------- */

  interface SeedQuestion {
    subjectId: typeof bangla._id;
    subjectName: string;
    chapterKey: string;
    topicKey: string;
    type: string;
    text: string;
    options?: { id: string; text: string }[];
    answer: {
      text?: string;
      correctOptions?: string[];
      booleanAnswer?: boolean | null;
    };
    difficulty: string;
    status: string;
  }

  const banglaQuestions: SeedQuestion[] = [
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-dhoni-o-borno",
      type: "MCQ",
      text: "বাংলা বর্ণমালায় স্বরবর্ণ কতটি?",
      options: [
        { id: "A", text: "10" },
        { id: "B", text: "11" },
        { id: "C", text: "12" },
        { id: "D", text: "13" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-dhoni-o-borno",
      type: "MCQ",
      text: "বাংলা বর্ণমালায় ব্যঞ্জনবর্ণ কতটি?",
      options: [
        { id: "A", text: "35" },
        { id: "B", text: "37" },
        { id: "C", text: "39" },
        { id: "D", text: "41" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-shomash",
      type: "MCQ",
      text: "'চাঁদমুখ' কোন সমাসের উদাহরণ?",
      options: [
        { id: "A", text: "উপমান কর্মধারয়" },
        { id: "B", text: "উপমিত কর্মধারয়" },
        { id: "C", text: "রূপক কর্মধারয়" },
        { id: "D", text: "দ্বন্দ্ব সমাস" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "MEDIUM",
      status: "PENDING",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-shobdo-utpotti",
      type: "MCQ",
      text: "নিচের কোনটি তৎসম শব্দ?",
      options: [
        { id: "A", text: "চাঁদ" },
        { id: "B", text: "নদী" },
        { id: "C", text: "চন্দ্র" },
        { id: "D", text: "পানি" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-sondhi",
      type: "TRUE_FALSE",
      text: "সন্ধির প্রধান উদ্দেশ্য উচ্চারণে সহজসাধ্যতা আনা।",
      answer: { booleanAnswer: true },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-shomash",
      type: "MCQ",
      text: "'হাতেখড়ি' কোন সমাসের উদাহরণ?",
      options: [
        { id: "A", text: "দ্বন্দ্ব সমাস" },
        { id: "B", text: "অলুক তৎপুরুষ সমাস" },
        { id: "C", text: "বহুব্রীহি সমাস" },
        { id: "D", text: "অব্যয়ীভাব সমাস" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-karok-o-bivokti",
      type: "MCQ",
      text: "'শিক্ষক ছাত্রকে বই দিলেন' — এই বাক্যে 'ছাত্রকে' কোন কারক?",
      options: [
        { id: "A", text: "কর্তৃকারক" },
        { id: "B", text: "কর্মকারক" },
        { id: "C", text: "সম্প্রদান কারক" },
        { id: "D", text: "অপাদান কারক" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "MEDIUM",
      status: "PENDING",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-shomash",
      type: "MCQ",
      text: "'রাজপুত্র' কোন সমাসের উদাহরণ?",
      options: [
        { id: "A", text: "দ্বিগু সমাস" },
        { id: "B", text: "ষষ্ঠী তৎপুরুষ সমাস" },
        { id: "C", text: "বহুব্রীহি সমাস" },
        { id: "D", text: "কর্মধারয় সমাস" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-bachyo-o-prottoy",
      type: "FILL_BLANK",
      text: "ক্রিয়ার মূল অংশকে বলা হয় ______।",
      answer: { text: "ধাতু" },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-ek-kothay-prokash",
      type: "MCQ",
      text: "'যা পূর্বে ছিল এখন নেই' — এক কথায় প্রকাশ করলে কী হয়?",
      options: [
        { id: "A", text: "ভূতপূর্ব" },
        { id: "B", text: "চিরন্তন" },
        { id: "C", text: "অনাগত" },
        { id: "D", text: "সাম্প্রতিক" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-karok-o-bivokti",
      type: "TRUE_FALSE",
      text: "বাক্যে প্রতিটি সমাপিকা ক্রিয়ার একটি কর্তা থাকে।",
      answer: { booleanAnswer: true },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-bachyo-o-prottoy",
      type: "MCQ",
      text: "'আমার যাওয়া হয়নি' — বাক্যটি কোন বাচ্যের উদাহরণ?",
      options: [
        { id: "A", text: "কর্তৃবাচ্য" },
        { id: "B", text: "কর্মবাচ্য" },
        { id: "C", text: "ভাববাচ্য" },
        { id: "D", text: "কর্মকর্তৃবাচ্য" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "HARD",
      status: "PENDING",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-grammar",
      topicKey: "bn-bachyo-o-prottoy",
      type: "MCQ",
      text: "'মধুর' শব্দের সঙ্গে 'তা' প্রত্যয় যুক্ত হলে কোন শব্দ গঠিত হয়?",
      options: [
        { id: "A", text: "মধুরতা" },
        { id: "B", text: "মধুরিমা" },
        { id: "C", text: "মধুরতর" },
        { id: "D", text: "মধুরিত" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-lit",
      topicKey: "bn-kabyagrontho",
      type: "MCQ",
      text: "'সোনার তরী' কাব্যগ্রন্থের রচয়িতা কে?",
      options: [
        { id: "A", text: "কাজী নজরুল ইসলাম" },
        { id: "B", text: "রবীন্দ্রনাথ ঠাকুর" },
        { id: "C", text: "জীবনানন্দ দাশ" },
        { id: "D", text: "সুকান্ত ভট্টাচার্য" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-lit",
      topicKey: "bn-kabyagrontho",
      type: "MCQ",
      text: "'বিদ্রোহী' কবিতাটির রচয়িতা কে?",
      options: [
        { id: "A", text: "কাজী নজরুল ইসলাম" },
        { id: "B", text: "রবীন্দ্রনাথ ঠাকুর" },
        { id: "C", text: "মাইকেল মধুসূদন দত্ত" },
        { id: "D", text: "বেগম রোকেয়া" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-lit",
      topicKey: "bn-kabyagrontho",
      type: "MCQ",
      text: "বাংলা ভাষার আদি নিদর্শন হিসেবে বিবেচিত গ্রন্থের নাম কী?",
      options: [
        { id: "A", text: "চর্যাপদ" },
        { id: "B", text: "মেঘনাদবধ কাব্য" },
        { id: "C", text: "শ্রীকৃষ্ণকীর্তন" },
        { id: "D", text: "মঙ্গলকাব্য" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-lit",
      topicKey: "bn-kobi-porichiti",
      type: "MULTIPLE_CORRECT",
      text: "নিচের কোনগুলো কাজী নজরুল ইসলামের রচনা?",
      options: [
        { id: "A", text: "বিদ্রোহী" },
        { id: "B", text: "সোনার তরী" },
        { id: "C", text: "অগ্নিবীণা" },
        { id: "D", text: "বিষের বাঁশি" },
      ],
      answer: { correctOptions: ["A", "C", "D"] },
      difficulty: "HARD",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-lit",
      topicKey: "bn-kobi-porichiti",
      type: "MCQ",
      text: "রবীন্দ্রনাথ ঠাকুর কত সালে সাহিত্যে নোবেল পুরস্কার লাভ করেন?",
      options: [
        { id: "A", text: "1912" },
        { id: "B", text: "1913" },
        { id: "C", text: "1914" },
        { id: "D", text: "1915" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-lit",
      topicKey: "bn-kabyagrontho",
      type: "SHORT",
      text: "মাইকেল মধুসূদন দত্ত রচিত একটি মহাকাব্যের নাম লেখো।",
      answer: { text: "মেঘনাদবধ কাব্য" },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: bangla._id,
      subjectName: "বাংলা",
      chapterKey: "bn-prose",
      topicKey: "bn-chotogolpo",
      type: "WRITTEN",
      text: "'নিমগাছ' গল্পের মূল বিষয়বস্তু সংক্ষেপে লেখো।",
      answer: {
        text: "গল্পে ঘরের আঙিনায় থাকা একটি অবহেলিত নিমগাছের মাধ্যমে সমাজে উপেক্ষিত ও অবমূল্যায়িত মানুষের, বিশেষত ঘরের নারীর, নীরব অবদান ও অবহেলার চিত্র প্রতীকীভাবে তুলে ধরা হয়েছে।",
      },
      difficulty: "HARD",
      status: "DRAFT",
    },
  ];

  const mathQuestions: SeedQuestion[] = [
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-algebra",
      topicKey: "mt-rashir-utpadok",
      type: "MCQ",
      text: "x² - 9 এর উৎপাদক (factorization) কোনটি?",
      options: [
        { id: "A", text: "(x - 3)(x + 3)" },
        { id: "B", text: "(x - 9)(x + 1)" },
        { id: "C", text: "(x - 3)²" },
        { id: "D", text: "(x + 3)²" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-algebra",
      topicKey: "mt-rashir-utpadok",
      type: "MCQ",
      text: "a² + 2ab + b² এর সরলীকৃত (উৎপাদকে বিশ্লেষিত) রূপ কোনটি?",
      options: [
        { id: "A", text: "(a + b)²" },
        { id: "B", text: "(a - b)²" },
        { id: "C", text: "a² - b²" },
        { id: "D", text: "(a + b)(a - b)" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-algebra",
      topicKey: "mt-somikoron",
      type: "FILL_BLANK",
      text: "x + 5 = 12 হলে x এর মান ______।",
      answer: { text: "7" },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-geometry",
      topicKey: "mt-pythagoras",
      type: "MCQ",
      text: "একটি সমকোণী ত্রিভুজের ভূমি 3 সেমি এবং লম্ব 4 সেমি হলে অতিভুজের দৈর্ঘ্য কত?",
      options: [
        { id: "A", text: "5 সেমি" },
        { id: "B", text: "6 সেমি" },
        { id: "C", text: "7 সেমি" },
        { id: "D", text: "8 সেমি" },
      ],
      answer: { correctOptions: ["A"] },
      difficulty: "MEDIUM",
      status: "PENDING",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-geometry",
      topicKey: "mt-tribhuj",
      type: "TRUE_FALSE",
      text: "সমবাহু ত্রিভুজের প্রতিটি কোণ 60° হয়।",
      answer: { booleanAnswer: true },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-geometry",
      topicKey: "mt-britto",
      type: "MCQ",
      text: "একটি বৃত্তের ব্যাস 14 সেমি হলে ব্যাসার্ধ কত?",
      options: [
        { id: "A", text: "5 সেমি" },
        { id: "B", text: "6 সেমি" },
        { id: "C", text: "7 সেমি" },
        { id: "D", text: "8 সেমি" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-geometry",
      topicKey: "mt-tribhuj",
      type: "MCQ",
      text: "একটি ত্রিভুজের তিনটি কোণের সমষ্টি কত?",
      options: [
        { id: "A", text: "90°" },
        { id: "B", text: "180°" },
        { id: "C", text: "270°" },
        { id: "D", text: "360°" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-arithmetic",
      topicKey: "mt-shotkora",
      type: "MCQ",
      text: "100 এর 20% কত?",
      options: [
        { id: "A", text: "15" },
        { id: "B", text: "20" },
        { id: "C", text: "25" },
        { id: "D", text: "30" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-arithmetic",
      topicKey: "mt-labh-khoti",
      type: "SHORT",
      text: "একটি দ্রব্যের ক্রয়মূল্য 500 টাকা এবং বিক্রয়মূল্য 600 টাকা হলে লাভের হার (শতকরা) কত?",
      answer: { text: "20%" },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-arithmetic",
      topicKey: "mt-munafa",
      type: "MCQ",
      text: "5% হার সরল মুনাফায় 1000 টাকার 2 বছরের মুনাফা কত?",
      options: [
        { id: "A", text: "50 টাকা" },
        { id: "B", text: "100 টাকা" },
        { id: "C", text: "150 টাকা" },
        { id: "D", text: "200 টাকা" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-arithmetic",
      topicKey: "mt-moulik-sonkha",
      type: "MULTIPLE_CORRECT",
      text: "নিচের কোনগুলো মৌলিক সংখ্যা (prime number)?",
      options: [
        { id: "A", text: "2" },
        { id: "B", text: "9" },
        { id: "C", text: "7" },
        { id: "D", text: "15" },
      ],
      answer: { correctOptions: ["A", "C"] },
      difficulty: "MEDIUM",
      status: "PENDING",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-mensuration",
      topicKey: "mt-khetrofol",
      type: "MCQ",
      text: "একটি আয়তক্ষেত্রের দৈর্ঘ্য 8 সেমি এবং প্রস্থ 5 সেমি হলে ক্ষেত্রফল কত?",
      options: [
        { id: "A", text: "13 বর্গ সেমি" },
        { id: "B", text: "26 বর্গ সেমি" },
        { id: "C", text: "40 বর্গ সেমি" },
        { id: "D", text: "45 বর্গ সেমি" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-mensuration",
      topicKey: "mt-khetrofol",
      type: "MCQ",
      text: "একটি বর্গক্ষেত্রের একবাহুর দৈর্ঘ্য 6 সেমি হলে পরিসীমা কত?",
      options: [
        { id: "A", text: "12 সেমি" },
        { id: "B", text: "18 সেমি" },
        { id: "C", text: "24 সেমি" },
        { id: "D", text: "36 সেমি" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-geometry",
      topicKey: "mt-kon",
      type: "FILL_BLANK",
      text: "সন্নিহিত কোণদ্বয়ের সমষ্টি 180° হলে তাদেরকে ______ কোণ বলে।",
      answer: { text: "সম্পূরক" },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-algebra",
      topicKey: "mt-somikoron",
      type: "MCQ",
      text: "x² = 25 হলে x এর মান কত?",
      options: [
        { id: "A", text: "5" },
        { id: "B", text: "-5" },
        { id: "C", text: "±5" },
        { id: "D", text: "25" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "MEDIUM",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-arithmetic",
      topicKey: "mt-moulik-sonkha",
      type: "TRUE_FALSE",
      text: "যেকোনো স্বাভাবিক সংখ্যা মূলদ সংখ্যা (rational number)।",
      answer: { booleanAnswer: true },
      difficulty: "HARD",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-algebra",
      topicKey: "mt-log",
      type: "MCQ",
      text: "log₁₀ 100 এর মান কত?",
      options: [
        { id: "A", text: "1" },
        { id: "B", text: "2" },
        { id: "C", text: "3" },
        { id: "D", text: "10" },
      ],
      answer: { correctOptions: ["B"] },
      difficulty: "HARD",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-mensuration",
      topicKey: "mt-ghonofol",
      type: "MCQ",
      text: "একটি ঘনকের একবাহুর দৈর্ঘ্য 3 সেমি হলে ঘনফল কত?",
      options: [
        { id: "A", text: "9 ঘন সেমি" },
        { id: "B", text: "18 ঘন সেমি" },
        { id: "C", text: "27 ঘন সেমি" },
        { id: "D", text: "81 ঘন সেমি" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-arithmetic",
      topicKey: "mt-moulik-sonkha",
      type: "MCQ",
      text: "12 ও 18 এর গরিষ্ঠ সাধারণ গুণনীয়ক (গ.সা.গু) কত?",
      options: [
        { id: "A", text: "2" },
        { id: "B", text: "3" },
        { id: "C", text: "6" },
        { id: "D", text: "9" },
      ],
      answer: { correctOptions: ["C"] },
      difficulty: "EASY",
      status: "APPROVED",
    },
    {
      subjectId: math._id,
      subjectName: "গণিত",
      chapterKey: "mt-geometry",
      topicKey: "mt-pythagoras",
      type: "WRITTEN",
      text: "পিথাগোরাসের উপপাদ্যটি বিবৃত করো।",
      answer: {
        text: "সমকোণী ত্রিভুজের অতিভুজের বর্গ, ভূমির বর্গ ও লম্বের বর্গের সমষ্টির সমান। অর্থাৎ, লম্ব² + ভূমি² = অতিভুজ²।",
      },
      difficulty: "MEDIUM",
      status: "DRAFT",
    },
  ];

  const allQuestions = [...banglaQuestions, ...mathQuestions];
  let inserted = 0;

  for (const item of allQuestions) {
    const chapterId = mustExist(chapterIds.get(item.chapterKey) ?? null, `chapter ${item.chapterKey}`);
    const topicId = mustExist(topicIds.get(item.topicKey) ?? null, `topic ${item.topicKey}`);
    const contentHash = questionContentHash(chapterId, item.text);

    const isApproved = item.status === "APPROVED";

    const result = await Question.updateOne(
      { chapter: chapterId, contentHash },
      {
        $set: {
          category: category._id,
          subject: item.subjectId,
          chapter: chapterId,
          topic: topicId,
          type: item.type,
          difficulty: item.difficulty,
          language: "bn",
          question: { text: item.text },
          options: item.options ?? [],
          answer: {
            text: item.answer.text ?? "",
            correctOptions: item.answer.correctOptions ?? [],
            booleanAnswer: item.answer.booleanAnswer ?? null,
            matchingPairs: [],
          },
          contentHash,
          marks: 1,
          tags: [item.subjectName, "নবম শ্রেণি"],
          status: item.status,
          isActive: true,
          createdBy: contentWriterId,
          approvedBy: isApproved ? reviewerId : null,
          approvedAt: isApproved ? new Date() : null,
        },
      },
      { upsert: true },
    ).exec();

    if (result.upsertedCount > 0) inserted += 1;
  }

  /* --------------------------------- Summary -------------------------------- */

  console.log("");
  console.log("Demo seed complete.");
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Users:        ${USER_ROLES.length} (one per role, all "Abdullah …", password: ${DEMO_PASSWORD})`);
  for (const role of USER_ROLES) {
    console.log(`    ${role.padEnd(20)} abdullah.${emailSlugs[role]}@demo.com`);
  }
  console.log(`  Category:     ${category.name}`);
  console.log(`  Subjects:     বাংলা, গণিত`);
  console.log(`  Chapters:     ${banglaChapters.length + mathChapters.length}`);
  console.log(
    `  Topics:       ${
      banglaChapters.reduce((n, c) => n + c.topics.length, 0) +
      mathChapters.reduce((n, c) => n + c.topics.length, 0)
    }`,
  );
  console.log(
    `  Questions:    ${allQuestions.length} (${banglaQuestions.length} বাংলা + ${mathQuestions.length} গণিত), ${inserted} newly inserted`,
  );
  console.log("");
  console.log("DEMO-ONLY credentials — never use these outside local development:");
  console.log(`  password for every demo account: ${DEMO_PASSWORD}`);
  console.log("");

  await disconnectDB();
}

main().catch((error: unknown) => {
  console.error("Demo seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
