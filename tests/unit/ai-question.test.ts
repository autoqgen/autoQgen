import { describe, expect, it } from "vitest";

import { buildQuestionPrompt, QUESTION_SYSTEM_PROMPT } from "@/lib/ai/question-prompt";
import { normaliseAiQuestion, normaliseAiReply } from "@/lib/ai/question-normalise";

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

  it("returns an empty list for a malformed reply", () => {
    expect(normaliseAiReply({ reply: "nope", requestedType: "MCQ", requestedDifficulty: null, limit: 10 })).toEqual([]);
    expect(normaliseAiReply({ reply: {}, requestedType: "MCQ", requestedDifficulty: null, limit: 10 })).toEqual([]);
  });
});
