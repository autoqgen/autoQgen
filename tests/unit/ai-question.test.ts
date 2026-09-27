import { describe, expect, it } from "vitest";

import {
  buildCreativeQuestionPrompt,
  buildCreativeQuestionReviewPrompt,
  buildQuestionPrompt,
  QUESTION_SYSTEM_PROMPT,
} from "@/lib/ai/question-prompt";
import {
  normaliseAiQuestion,
  normaliseAiReply,
  validateCreativeGroupStructure,
} from "@/lib/ai/question-normalise";

/**
 * Pure-function coverage for the AI question pipeline: prompt construction and
 * the normalise/validate step that decides "Needs Review". No network, no DB.
 */

describe("buildQuestionPrompt", () => {
  const base = {
    categoryName: "Class 8",
    subjectName: "Science",
    chapterName: "Force and Motion",
    topicName: "Friction" as string | null,
    type: "MCQ" as const,
    difficulty: "MEDIUM" as const,
    language: "en" as const,
    count: 10,
    instruction: "",
  };

  it("pins the count, type and full taxonomy scope", () => {
    const prompt = buildQuestionPrompt(base);
    expect(prompt).toContain("exactly 10 MCQ questions");
    expect(prompt).toContain("Category: Class 8");
    expect(prompt).toContain("Subject: Science");
    expect(prompt).toContain("Chapter: Force and Motion");
    expect(prompt).toContain("Topic: Friction");
  });

  describe("buildCreativeQuestionPrompt", () => {
    it("requires one shared stimulus and the four ordered cognitive parts", () => {
      const prompt = buildCreativeQuestionPrompt({
        categoryName: "Class 8",
        subjectName: "Science",
        chapterName: "Force and Motion",
        topicName: null,
        difficulty: null,
        language: "bn",
        instruction: "Use a real-life example.",
      });
      expect(prompt).toContain("exactly one original, academically correct, complete Bangladeshi-style Creative Question");
      expect(prompt).toContain("one JSON object");
      expect(prompt).toContain("exactly four ordered part objects");
      expect(prompt).toContain("জ্ঞানমূলক, exactly 1 mark");
      expect(prompt).toContain("অনুধাবনমূলক, exactly 2 marks");
      expect(prompt).toContain("exactly 3 marks");
      expect(prompt).toContain("উচ্চতর দক্ষতা/বিশ্লেষণমূলক, exactly 4 marks");
      expect(prompt).toContain("Scientific and mathematical accuracy is mandatory");
      expect(prompt).toContain("preserve its measurement basis and units");
      expect(prompt).toContain("vary one factor at a time");
      expect(prompt).toContain("how any quantitative outcome was measured");
      expect(prompt).toContain("Use a real-life example.");
      expect(prompt).toContain("answer");
    });
  });

  it("forbids markdown and placeholder output", () => {
    const prompt = buildQuestionPrompt(base);
    expect(prompt).toMatch(/valid JSON only/i);
    expect(prompt).toMatch(/placeholder/i);
    expect(QUESTION_SYSTEM_PROMPT).toMatch(/only a single JSON object/i);
  });

  it("carries the optional user instruction through", () => {
    const prompt = buildQuestionPrompt({ ...base, instruction: "Focus on conceptual questions." });
    expect(prompt).toContain("Focus on conceptual questions.");
  });

  it("omits the topic line when no topic is given", () => {
    const prompt = buildQuestionPrompt({ ...base, topicName: null });
    expect(prompt).not.toContain("Topic:");
  });
});

describe("normaliseAiQuestion — MCQ", () => {
  const raw = {
    text: "What is the SI unit of force?",
    type: "MCQ",
    options: ["Joule", "Newton", "Watt", "Pascal"],
    answer: ["Newton"],
    difficulty: "EASY",
    marks: 1,
    explanation: "The SI unit of force is the newton.",
  };

  it("maps option texts to lettered ids and resolves the answer", () => {
    const { question, issues } = normaliseAiQuestion({
      raw,
      requestedType: "MCQ",
      requestedDifficulty: null,
    });
    expect(issues).toEqual([]);
    expect(question.options.map((option) => option.id)).toEqual(["A", "B", "C", "D"]);
    expect(question.answer.correctOptions).toEqual(["B"]);
    expect(question.type).toBe("MCQ");
  });

  it("forces the requested difficulty when one was selected", () => {
    const { question } = normaliseAiQuestion({
      raw,
      requestedType: "MCQ",
      requestedDifficulty: "HARD",
    });
    expect(question.difficulty).toBe("HARD");
  });

  it("flags an answer that matches no option", () => {
    const { issues } = normaliseAiQuestion({
      raw: { ...raw, answer: ["Kelvin"] },
      requestedType: "MCQ",
      requestedDifficulty: null,
    });
    expect(issues.join(" ")).toMatch(/does not match any option/i);
  });

  it("flags a type mismatch against the requested type", () => {
    const { issues } = normaliseAiQuestion({
      raw: { ...raw, type: "SHORT" },
      requestedType: "MCQ",
      requestedDifficulty: null,
    });
    expect(issues.join(" ")).toMatch(/SHORT.*MCQ was requested/i);
  });

  it("flags placeholder option text", () => {
    const { issues } = normaliseAiQuestion({
      raw: { ...raw, options: ["Option A", "Option B", "Option C", "Option D"] },
      requestedType: "MCQ",
      requestedDifficulty: null,
    });
    expect(issues.join(" ")).toMatch(/placeholder/i);
  });
});

describe("normaliseAiQuestion — other types", () => {
  it("normalises TRUE_FALSE to a boolean answer and no options", () => {
    const { question, issues } = normaliseAiQuestion({
      raw: { text: "Friction always opposes motion.", type: "TRUE_FALSE", options: ["True", "False"], answer: ["True"] },
      requestedType: "TRUE_FALSE",
      requestedDifficulty: null,
    });
    expect(issues).toEqual([]);
    expect(question.options).toEqual([]);
    expect(question.answer.booleanAnswer).toBe(true);
  });

  it("normalises SHORT to answer text and flags an empty answer", () => {
    const ok = normaliseAiQuestion({
      raw: { text: "Define friction.", type: "SHORT", options: [], answer: ["A force that opposes relative motion."] },
      requestedType: "SHORT",
      requestedDifficulty: null,
    });
    expect(ok.issues).toEqual([]);
    expect(ok.question.answer.text).toMatch(/opposes relative motion/);

    const bad = normaliseAiQuestion({
      raw: { text: "Define friction.", type: "SHORT", options: [], answer: [] },
      requestedType: "SHORT",
      requestedDifficulty: null,
    });
    expect(bad.issues.length).toBeGreaterThan(0);
  });

  it("wants a blank marker in a FILL_BLANK stem", () => {
    const { issues } = normaliseAiQuestion({
      raw: { text: "Friction converts kinetic energy to heat.", type: "FILL_BLANK", options: [], answer: ["heat"] },
      requestedType: "FILL_BLANK",
      requestedDifficulty: null,
    });
    expect(issues.join(" ")).toMatch(/blank/i);
  });
});

describe("normaliseAiReply", () => {
  it("reads the questions array and caps at the limit", () => {
    const reply = {
      questions: Array.from({ length: 5 }, (_, index) => ({
        text: `Question number ${index} about friction?`,
        type: "MCQ",
        options: ["a", "b", "c", "d"],
        answer: ["a"],
        difficulty: "MEDIUM",
        marks: 1,
        explanation: "because",
      })),
    };
    const out = normaliseAiReply({ reply, requestedType: "MCQ", requestedDifficulty: null, limit: 3 });
    expect(out).toHaveLength(3);
  });

  describe("Creative Question quality checks", () => {
    const validParts = [
      {
        type: "WRITTEN" as const,
        difficulty: "EASY" as const,
        question: { text: "সুমাইয়ার দ্রবণে পানি কোন ভূমিকা পালন করছে? দ্রাবক কী?" },
        options: [],
        answer: { text: "যে পদার্থে অন্য পদার্থ দ্রবীভূত হয় তাকে দ্রাবক বলে। এই দ্রবণে পানি দ্রাবক।", correctOptions: [], booleanAnswer: null },
        explanation: "",
        marks: 1,
      },
      {
        type: "WRITTEN" as const,
        difficulty: "MEDIUM" as const,
        question: { text: "প্রথমে লবণ অদৃশ্য হওয়ার পর দ্রবণটি সমসত্ত্ব হলো কেন?" },
        options: [],
        answer: { text: "লবণ পানিতে সম্পূর্ণ দ্রবীভূত হয়ে দ্রবণের সব অংশে সমানভাবে ছড়িয়ে পড়ে। তাই মিশ্রণের গঠন সর্বত্র একই থাকে।", correctOptions: [], booleanAnswer: null },
        explanation: "",
        marks: 2,
      },
      {
        type: "WRITTEN" as const,
        difficulty: "HARD" as const,
        question: { text: "আর লবণ না মেশার কারণটি সুমাইয়ার পরীক্ষার ঘটনায় ব্যাখ্যা কর।" },
        options: [],
        answer: { text: "নির্দিষ্ট তাপমাত্রায় পানিতে সর্বোচ্চ পরিমাণ লবণ দ্রবীভূত হয়েছে। দ্রবণটি সম্পৃক্ত হওয়ায় অতিরিক্ত লবণ আর দ্রবীভূত না হয়ে নিচে জমেছে।", correctOptions: [], booleanAnswer: null },
        explanation: "",
        marks: 3,
      },
      {
        type: "WRITTEN" as const,
        difficulty: "HARD" as const,
        question: { text: "সুমাইয়া পানি বাড়ালে অবদ্রবীভূত লবণের কী হবে? যুক্তিসহ বিশ্লেষণ কর।" },
        options: [],
        answer: { text: "পানির পরিমাণ বাড়লে দ্রাবকের পরিমাণও বাড়বে। ফলে আরও বেশি লবণ দ্রবীভূত হতে পারবে এবং অবদ্রবীভূত লবণের একটি অংশ বা সবটুকু মিশতে পারে। তাই দ্রবীভূত লবণের পরিমাণ বাড়বে।", correctOptions: [], booleanAnswer: null },
        explanation: "",
        marks: 4,
      },
    ];

    it("accepts adequate answer depth and exact marks for a complete stimulus-led CQ", () => {
      expect(validateCreativeGroupStructure({
        stimulus: "সুমাইয়া একটি গ্লাস পানিতে লবণ মিশিয়ে নাড়ল। পরে আরও লবণ দিলে কিছু লবণ নিচে জমে থাকল।",
        parts: validParts,
      })).toEqual([]);
    });

    it("rejects short stimuli, repeated parts, incorrect marks, and shallow explanatory answers", () => {
      const issues = validateCreativeGroupStructure({
        stimulus: "লবণ পানিতে মেশে।",
        parts: [
          ...validParts.slice(0, 3),
          { ...validParts[3]!, question: validParts[2]!.question, marks: 1, answer: { ...validParts[3]!.answer, text: "মিশবে।" } },
        ],
      });
      expect(issues.some((issue) => /stimulus is too short/i.test(issue))).toBe(true);
      expect(issues.some((issue) => /repeated/i.test(issue))).toBe(true);
      expect(issues.some((issue) => /must be worth 4 mark/i.test(issue))).toBe(true);
      expect(issues.some((issue) => /too brief/i.test(issue))).toBe(true);
    });

    it("asks the reviewer to audit stimulus dependence, progression, and answer depth", () => {
      const prompt = buildCreativeQuestionReviewPrompt({
        categoryName: "Class 8",
        subjectName: "Science",
        chapterName: "Solutions",
        topicName: "Solubility",
        stimulus: "A student dissolves salt in water.",
        parts: validParts.map((part, index) => ({
          label: ["ক", "খ", "গ", "ঘ"][index]!,
          cognitiveLevel: ["knowledge", "understanding", "application", "higher_order"][index]!,
          marks: index + 1,
          type: part.type,
          text: part.question.text,
          options: [],
          answer: [part.answer.text],
        })),
      });
      expect(prompt).toContain("directly anchored in or requires reasoning about that exact stimulus");
      expect(prompt).toContain("progression");
      expect(prompt).toContain("Check factual correctness in every stimulus detail");
      expect(prompt).toContain("Independently recompute numerical work step by step");
      expect(prompt).toContain("plausible measurement method");
      expect(prompt).toContain("never invent a midpoint or exact minimum");
      expect(prompt).toContain("does not prove equal starting speed or energy");
      expect(prompt).toContain("fail closed");
      expect(prompt).toContain("Distinguish a process/rate from an equilibrium property");
      expect(prompt).toContain("faster molecular motion/collisions alone do not explain");
      expect(prompt).toContain("pass may be true only if ALL checks pass");
    });
  });

  it("returns an empty list for a malformed reply", () => {
    expect(normaliseAiReply({ reply: "nope", requestedType: "MCQ", requestedDifficulty: null, limit: 10 })).toEqual([]);
    expect(normaliseAiReply({ reply: {}, requestedType: "MCQ", requestedDifficulty: null, limit: 10 })).toEqual([]);
  });
});
