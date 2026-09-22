import { loadEnvFiles } from "./load-env";

loadEnvFiles();

import { Types } from "mongoose";
import { questionContentHash } from "@/lib/security/hash";

type Difficulty = "EASY" | "MEDIUM" | "HARD";
type QuestionSeed = { topic: string; difficulty: Difficulty; text: string };
type ChapterSeed = { subject: string; chapter: string; questions: QuestionSeed[] };

const question = (
  topic: string | undefined,
  difficulty: string | undefined,
  text: string | undefined,
): QuestionSeed => {
  if (topic === undefined || text === undefined || difficulty === undefined) {
    throw new Error("Question data is incomplete in the insertion dataset.");
  }
  if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
    throw new Error(`Unsupported difficulty in insertion dataset: ${difficulty}`);
  }
  return { topic, difficulty: difficulty as Difficulty, text };
};

const DATA: ChapterSeed[] = [
  {
    subject: "Science",
    chapter: "বল ও চাপ",
    questions: [
      ["বলের ধারণা", "EASY", "বল কাকে বলে?"],
      ["বলের একক", "EASY", "বল পরিমাপের আন্তর্জাতিক একক কী?"],
      ["বলের প্রভাব", "EASY", "কোনো বস্তুর ওপর বল প্রয়োগ করলে কী কী পরিবর্তন ঘটতে পারে?"],
      ["ঘর্ষণ বল", "MEDIUM", "হাঁটার সময় জুতার তলা ও মাটির মধ্যে ঘর্ষণ বল কীভাবে আমাদের সাহায্য করে?"],
      ["মহাকর্ষ বল", "MEDIUM", "কোনো বস্তু ওপরের দিকে ছুড়ে দিলে তা আবার মাটিতে ফিরে আসে কেন?"],
      ["চাপের ধারণা", "MEDIUM", "চাপ কাকে বলে এবং চাপ নির্ণয়ের সূত্র কী?"],
      ["ক্ষেত্রফল ও চাপ", "MEDIUM", "ধারালো ছুরি ভোঁতা ছুরির তুলনায় সহজে কোনো বস্তু কাটতে পারে কেন?"],
      ["তরলের চাপ", "HARD", "বাঁধের নিচের অংশ ওপরের অংশের তুলনায় মোটা করে তৈরি করা হয় কেন?"],
      ["বায়ুর চাপ", "HARD", "একটি খালি বোতল চেপে ধরার পর মুখ বন্ধ করে ছেড়ে দিলে বোতলটি আগের অবস্থায় ফিরতে চায় কেন?"],
      ["দৈনন্দিন জীবনে চাপ", "HARD", "স্কুলব্যাগের ফিতা চওড়া হলে কাঁধে চাপ কম অনুভূত হয়—চাপের ধারণা ব্যবহার করে ব্যাখ্যা করো।"],
    ].map(([topic, difficulty, text]) => question(topic, difficulty, text)),
  },
  {
    subject: "Science",
    chapter: "জীবকোষের গঠন",
    questions: [
      ["কোষের ধারণা", "EASY", "কোষ কাকে বলে?"],
      ["কোষের আবিষ্কার", "EASY", "কোষ প্রথম কে আবিষ্কার করেন?"],
      ["কোষের অংশ", "EASY", "একটি আদর্শ কোষের প্রধান তিনটি অংশের নাম লেখো।"],
      ["কোষঝিল্লি", "MEDIUM", "কোষঝিল্লির দুটি কাজ লেখো।"],
      ["কোষপ্রাচীর", "MEDIUM", "উদ্ভিদকোষে কোষপ্রাচীরের প্রয়োজনীয়তা ব্যাখ্যা করো।"],
      ["নিউক্লিয়াস", "MEDIUM", "নিউক্লিয়াসকে কোষের নিয়ন্ত্রণকেন্দ্র বলা হয় কেন?"],
      ["উদ্ভিদকোষ ও প্রাণিকোষ", "MEDIUM", "উদ্ভিদকোষ ও প্রাণিকোষের মধ্যে দুটি পার্থক্য লেখো।"],
      ["ক্লোরোপ্লাস্ট", "HARD", "ক্লোরোপ্লাস্ট না থাকলে সবুজ উদ্ভিদের খাদ্য তৈরিতে কী সমস্যা হবে?"],
      ["কোষের অঙ্গাণু", "HARD", "মাইটোকন্ড্রিয়াকে কোষের শক্তিঘর বলা হয় কেন?"],
      ["কোষ ও জীবদেহ", "HARD", "এককোষী ও বহুকোষী জীবের মধ্যে পার্থক্য উদাহরণসহ ব্যাখ্যা করো।"],
    ].map(([topic, difficulty, text]) => question(topic, difficulty, text)),
  },
  {
    subject: "Bangla",
    chapter: "গদ্য — শিক্ষামূলক ও মানবিক মূল্যবোধের পাঠ",
    questions: [
      ["মূলভাব", "EASY", "একটি গদ্যাংশের মূলভাব বলতে কী বোঝায়?"],
      ["শব্দার্থ", "EASY", "‘সহমর্মিতা’ শব্দের অর্থ লেখো।"],
      ["তথ্য শনাক্তকরণ", "EASY", "গদ্যাংশে লেখক কোন মানবিক গুণের প্রশংসা করেছেন—তা চিহ্নিত করো।"],
      ["প্রশ্নোত্তর", "MEDIUM", "গদ্যাংশের প্রধান চরিত্রটি কীভাবে সমস্যার সমাধান করেছিল?"],
      ["কারণ ও ফলাফল", "MEDIUM", "গদ্যাংশে বর্ণিত ঘটনার প্রধান কারণ ও ফলাফল ব্যাখ্যা করো।"],
      ["চরিত্র বিশ্লেষণ", "MEDIUM", "গদ্যাংশের প্রধান চরিত্রের দুটি গুণ উদাহরণসহ লেখো।"],
      ["বক্তব্য বিশ্লেষণ", "MEDIUM", "“মানুষ মানুষের জন্য”—এই বক্তব্যটি গদ্যাংশের আলোকে ব্যাখ্যা করো।"],
      ["শিক্ষা ও মূল্যবোধ", "HARD", "গদ্যাংশের শিক্ষা বাস্তব জীবনে কীভাবে প্রয়োগ করা যায়?"],
      ["তুলনামূলক বিশ্লেষণ", "HARD", "গদ্যাংশের দুই চরিত্রের আচরণের তুলনা করে তাদের পার্থক্য ব্যাখ্যা করো।"],
      ["সৃজনশীল প্রতিক্রিয়া", "HARD", "গদ্যাংশের ঘটনাটি বর্তমান সমাজের একটি বাস্তব ঘটনার সঙ্গে তুলনা করে নিজের মতামত লেখো।"],
    ].map(([topic, difficulty, text]) => question(topic, difficulty, text)),
  },
  {
    subject: "Bangla",
    chapter: "পদ্য — প্রকৃতি, দেশ ও মানবতা",
    questions: [
      ["কবিতার ভাব", "EASY", "কবিতাটির প্রধান ভাব কী?"],
      ["শব্দার্থ", "EASY", "‘অমলিন’ ও ‘স্নিগ্ধ’ শব্দের অর্থ লেখো।"],
      ["চিত্রকল্প", "EASY", "কবিতায় কোন প্রাকৃতিক দৃশ্যের বর্ণনা দেওয়া হয়েছে?"],
      ["কবির অনুভূতি", "MEDIUM", "কবিতায় কবির দেশপ্রেম কীভাবে প্রকাশ পেয়েছে?"],
      ["উপমা ও রূপক", "MEDIUM", "কবিতায় ব্যবহৃত একটি উপমা চিহ্নিত করে তার অর্থ ব্যাখ্যা করো।"],
      ["প্রকৃতির ভূমিকা", "MEDIUM", "কবিতায় প্রকৃতি মানুষের মনে কী ধরনের অনুভূতি সৃষ্টি করেছে?"],
      ["শব্দ ও ছন্দ", "MEDIUM", "কবিতার ছন্দ ও শব্দচয়ন কীভাবে এর সৌন্দর্য বাড়িয়েছে?"],
      ["ভাবব্যাখ্যা", "HARD", "“দেশের মাটি ও মানুষ পরস্পরের সঙ্গে গভীরভাবে যুক্ত”—কবিতার আলোকে বক্তব্যটি ব্যাখ্যা করো।"],
      ["প্রতীক বিশ্লেষণ", "HARD", "কবিতায় ব্যবহৃত কোনো একটি প্রতীকের অন্তর্নিহিত অর্থ বিশ্লেষণ করো।"],
      ["মূল্যায়ন", "HARD", "কবিতার মূল বার্তা আজকের শিক্ষার্থীদের জন্য কেন গুরুত্বপূর্ণ—যুক্তিসহ লেখো।"],
    ].map(([topic, difficulty, text]) => question(topic, difficulty, text)),
  },
  {
    subject: "ICT",
    chapter: "তথ্য ও যোগাযোগ প্রযুক্তির ধারণা",
    questions: [
      ["তথ্য ও উপাত্ত", "EASY", "তথ্য ও উপাত্তের মধ্যে পার্থক্য কী?"],
      ["ICT-এর সংজ্ঞা", "EASY", "তথ্য ও যোগাযোগ প্রযুক্তি বলতে কী বোঝায়?"],
      ["যোগাযোগের মাধ্যম", "EASY", "তথ্য আদান-প্রদানের দুটি আধুনিক মাধ্যমের নাম লেখো।"],
      ["শিক্ষাক্ষেত্রে ICT", "MEDIUM", "শিক্ষাক্ষেত্রে তথ্য ও যোগাযোগ প্রযুক্তির দুটি ব্যবহার লেখো।"],
      ["স্বাস্থ্যসেবায় ICT", "MEDIUM", "দূরবর্তী রোগীর চিকিৎসায় ICT কীভাবে সহায়তা করতে পারে?"],
      ["ই-সেবা", "MEDIUM", "ই-সেবা ব্যবহারের দুটি সুবিধা ব্যাখ্যা করো।"],
      ["ডিজিটাল যোগাযোগ", "MEDIUM", "ডাকযোগে চিঠি পাঠানো ও ই-মেইল পাঠানোর মধ্যে পার্থক্য লেখো।"],
      ["ICT ও কর্মসংস্থান", "HARD", "তথ্য ও যোগাযোগ প্রযুক্তি কীভাবে নতুন কর্মসংস্থানের সুযোগ তৈরি করে?"],
      ["ডিজিটাল বৈষম্য", "HARD", "ডিজিটাল বৈষম্য কী এবং এটি কমানোর দুটি উপায় লেখো।"],
      ["ICT-এর সামাজিক প্রভাব", "HARD", "ICT ব্যবহারের একটি ইতিবাচক ও একটি নেতিবাচক সামাজিক প্রভাব বিশ্লেষণ করো।"],
    ].map(([topic, difficulty, text]) => question(topic, difficulty, text)),
  },
  {
    subject: "ICT",
    chapter: "কম্পিউটার নিরাপত্তা ও নৈতিক ব্যবহার",
    questions: [
      ["কম্পিউটার নিরাপত্তা", "EASY", "কম্পিউটার নিরাপত্তা বলতে কী বোঝায়?"],
      ["পাসওয়ার্ড", "EASY", "শক্তিশালী পাসওয়ার্ডের দুটি বৈশিষ্ট্য লেখো।"],
      ["ভাইরাস", "EASY", "কম্পিউটার ভাইরাস কী?"],
      ["অ্যান্টিভাইরাস", "MEDIUM", "অ্যান্টিভাইরাস সফটওয়্যারের কাজ কী?"],
      ["ব্যক্তিগত তথ্য", "MEDIUM", "অনলাইনে ব্যক্তিগত তথ্য প্রকাশ করা ঝুঁকিপূর্ণ কেন?"],
      ["ফিশিং", "MEDIUM", "ফিশিং কী এবং এটি থেকে বাঁচার একটি উপায় লেখো।"],
      ["কপিরাইট", "MEDIUM", "কপিরাইট আইন মেনে চলা কেন প্রয়োজন?"],
      ["নিরাপদ ইন্টারনেট ব্যবহার", "HARD", "কোনো অপরিচিত ব্যক্তি অনলাইনে বন্ধুত্বের অনুরোধ পাঠালে একজন শিক্ষার্থীর কী কী সতর্কতা অবলম্বন করা উচিত?"],
      ["সাইবার বুলিং", "HARD", "সাইবার বুলিংয়ের শিকার হলে একজন শিক্ষার্থী কীভাবে বিষয়টি মোকাবিলা করতে পারে?"],
      ["ডিজিটাল নৈতিকতা", "HARD", "কারও অনুমতি ছাড়া তার ছবি অনলাইনে প্রকাশ করা কেন অনৈতিক? ব্যাখ্যা করো।"],
    ].map(([topic, difficulty, text]) => question(topic, difficulty, text)),
  },
];

async function main(): Promise<void> {
  const [{ connectDB, disconnectDB }, models] = await Promise.all([
    import("@/lib/db"),
    import("@/models"),
  ]);
  const { Organization, User, Category, Subject, Chapter, Topic, Question } = models;

  await connectDB();
  try {
    const organization = await Organization.findOne({ name: "Abdullah Organization" }).exec();
    if (!organization) throw new Error("Abdullah Organization was not found.");
    const category = await Category.findOne({
      organizationId: organization._id,
      name: /^class 7$/i,
    }).exec();
    if (!category) throw new Error("Class 7 category was not found in Abdullah Organization.");

    const creator = await User.findOne({ email: "abdullahakib313@gmail.com" }).select("_id").exec();
    if (!creator) throw new Error("Demo organization owner was not found.");

    const subjects = new Map<string, { _id: Types.ObjectId }>();
    const chapters = new Map<string, { _id: Types.ObjectId }>();
    const topics = new Map<string, { _id: Types.ObjectId }>();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [subjectIndex, seed] of DATA.entries()) {
      const subject = await Subject.findOneAndUpdate(
        { organizationId: organization._id, category: category._id, name: seed.subject },
        {
          $setOnInsert: {
            organizationId: organization._id,
            category: category._id,
            name: seed.subject,
            slug: seed.subject.toLowerCase().replace(/\s+/g, "-"),
            classLevel: "Class 7",
            order: subjectIndex,
            isActive: true,
            createdBy: creator._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec();
      subjects.set(seed.subject, subject);

      const chapter = await Chapter.findOneAndUpdate(
        { organizationId: organization._id, subject: subject._id, name: seed.chapter },
        {
          $setOnInsert: {
            organizationId: organization._id,
            category: category._id,
            subject: subject._id,
            name: seed.chapter,
            slug: seed.chapter.toLowerCase().replace(/\s+/g, "-"),
            chapterNo: subjectIndex + 1,
            order: subjectIndex,
            isActive: true,
            createdBy: creator._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec();
      chapters.set(`${seed.subject}:${seed.chapter}`, chapter);

      for (const [topicIndex, question] of seed.questions.entries()) {
        const topic = await Topic.findOneAndUpdate(
          { organizationId: organization._id, chapter: chapter._id, name: question.topic },
          {
            $setOnInsert: {
              organizationId: organization._id,
              category: category._id,
              subject: subject._id,
              chapter: chapter._id,
              name: question.topic,
              slug: question.topic.toLowerCase().replace(/\s+/g, "-"),
              order: topicIndex,
              isActive: true,
              createdBy: creator._id,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).exec();
        topics.set(`${seed.subject}:${seed.chapter}:${question.topic}`, topic);

        const contentHash = questionContentHash(chapter._id.toString(), question.text);
        const existing = await Question.exists({
          organizationId: organization._id,
          contentHash,
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        try {
          await Question.create({
            organizationId: organization._id,
            category: category._id,
            subject: subject._id,
            chapter: chapter._id,
            topic: topic._id,
            board: null,
            exam: null,
            type: "WRITTEN",
            difficulty: question.difficulty,
            language: "bn",
            question: { text: question.text, image: "", audio: "", video: "", passage: "", latex: "" },
            options: [],
            answer: { text: "", correctOptions: [], booleanAnswer: null, matchingPairs: [] },
            explanation: "",
            contentHash,
            source: "Bangladesh Class 7 curriculum fallback",
            session: "",
            year: null,
            marks: 1,
            estimatedTime: 60,
            tags: [seed.subject, seed.chapter, question.topic],
            aiGenerated: false,
            status: "DRAFT",
            isActive: true,
            createdBy: creator._id,
            updatedBy: null,
            approvedBy: null,
            approvedAt: null,
            reviewNote: "",
          });
          inserted += 1;
        } catch (error) {
          errors.push(`${seed.subject}/${seed.chapter}/${question.text}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const counts = await Question.aggregate([
      { $match: { organizationId: organization._id, category: category._id, subject: { $in: [...subjects.values()].map((item) => item._id) } } },
      { $group: { _id: { subject: "$subject", chapter: "$chapter" }, count: { $sum: 1 } } },
    ]);
    console.log(JSON.stringify({
      organization: organization.name,
      category: category.name,
      subjects: [...subjects.keys()],
      chapters: [...chapters.keys()],
      topics: topics.size,
      inserted,
      skipped,
      errors,
      counts: counts.map((item) => ({ subject: item._id.subject.toString(), chapter: item._id.chapter.toString(), count: item.count })),
    }, null, 2));
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
