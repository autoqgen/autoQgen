import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

import {
  presentQuestion,
  validateAnswerForType,
  validateHierarchyRefs,
  type HierarchyContext,
} from "@/lib/services/question.service";
import type { AuthContext } from "@/lib/auth/session";
import type { QuestionDoc } from "@/lib/repositories/question.repo";
import type { UserRole } from "@/types/roles";

function actor(role: UserRole): AuthContext {
  const id = "507f1f77bcf86cd799439011";
  return {
    id,
    objectId: new Types.ObjectId(id),
    email: `${role}@example.com`,
    name: role,
    role,
    status: "active",
    organizationId: null,
  };
}

const emptyAnswer = {
  text: "",
  correctOptions: [] as string[],
  booleanAnswer: null as boolean | null,
  matchingPairs: [] as { left: string; right: string }[],
};

describe("validateAnswerForType", () => {
  const options = [
    { id: "A", text: "one" },
    { id: "B", text: "two" },
  ];

  it("accepts a well-formed MCQ", () => {
    expect(
      validateAnswerForType("MCQ", options, { ...emptyAnswer, correctOptions: ["A"] }),
    ).toEqual([]);
  });

  it("rejects an MCQ with more than one correct option", () => {
    const issues = validateAnswerForType("MCQ", options, {
      ...emptyAnswer,
      correctOptions: ["A", "B"],
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it("rejects a correct option that is not in the option list", () => {
    const issues = validateAnswerForType("MCQ", options, {
      ...emptyAnswer,
      correctOptions: ["Z"],
    });
    expect(issues.some((issue) => issue.path === "answer.correctOptions")).toBe(true);
  });

  it("requires two correct options for MULTIPLE_CORRECT", () => {
    expect(
      validateAnswerForType("MULTIPLE_CORRECT", options, {
        ...emptyAnswer,
        correctOptions: ["A"],
      }).length,
    ).toBeGreaterThan(0);

    expect(
      validateAnswerForType("MULTIPLE_CORRECT", options, {
        ...emptyAnswer,
        correctOptions: ["A", "B"],
      }),
    ).toEqual([]);
  });

  it("requires a boolean for TRUE_FALSE", () => {
    expect(validateAnswerForType("TRUE_FALSE", [], emptyAnswer).length).toBeGreaterThan(0);
    expect(
      validateAnswerForType("TRUE_FALSE", [], { ...emptyAnswer, booleanAnswer: false }),
    ).toEqual([]);
  });

  it("requires answer text for written types", () => {
    expect(validateAnswerForType("WRITTEN", [], emptyAnswer).length).toBeGreaterThan(0);
    expect(
      validateAnswerForType("WRITTEN", [], { ...emptyAnswer, text: "Because of inertia." }),
    ).toEqual([]);
  });

  it("requires at least two pairs for MATCHING", () => {
    expect(validateAnswerForType("MATCHING", [], emptyAnswer).length).toBeGreaterThan(0);
    expect(
      validateAnswerForType("MATCHING", [], {
        ...emptyAnswer,
        matchingPairs: [
          { left: "a", right: "1" },
          { left: "b", right: "2" },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects duplicate option identifiers", () => {
    const issues = validateAnswerForType(
      "MCQ",
      [
        { id: "A", text: "one" },
        { id: "A", text: "two" },
      ],
      { ...emptyAnswer, correctOptions: ["A"] },
    );
    expect(issues.some((issue) => issue.path === "options")).toBe(true);
  });
});

describe("validateHierarchyRefs", () => {
  const CATEGORY = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const OTHER_CATEGORY = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const SUBJECT = "cccccccccccccccccccccccc";
  const CHAPTER = "dddddddddddddddddddddddd";
  const TOPIC = "eeeeeeeeeeeeeeeeeeeeeeee";

  const context: HierarchyContext = {
    categories: new Set([CATEGORY, OTHER_CATEGORY]),
    subjects: new Map([[SUBJECT, { category: CATEGORY }]]),
    chapters: new Map([[CHAPTER, { category: CATEGORY, subject: SUBJECT }]]),
    topics: new Map([[TOPIC, { chapter: CHAPTER }]]),
    boards: new Set<string>(),
    exams: new Set<string>(),
  };

  const refs = {
    category: CATEGORY,
    subject: SUBJECT,
    chapter: CHAPTER,
    topic: null,
    board: null,
    exam: null,
  };

  it("accepts a consistent hierarchy", () => {
    expect(validateHierarchyRefs(refs, context)).toEqual([]);
  });

  it("rejects a subject that belongs to a different category", () => {
    const issues = validateHierarchyRefs({ ...refs, category: OTHER_CATEGORY }, context);
    expect(issues.some((issue) => issue.path === "subject")).toBe(true);
  });

  it("rejects a chapter that is not under the supplied subject", () => {
    const otherSubject = "ffffffffffffffffffffffff";
    const extended: HierarchyContext = {
      ...context,
      subjects: new Map([
        ...context.subjects,
        [otherSubject, { category: CATEGORY }],
      ]),
    };

    const issues = validateHierarchyRefs({ ...refs, subject: otherSubject }, extended);
    expect(issues.some((issue) => issue.path === "chapter")).toBe(true);
  });

  it("rejects a non-existent reference", () => {
    const issues = validateHierarchyRefs(
      { ...refs, chapter: "111111111111111111111111" },
      context,
    );
    expect(issues.some((issue) => issue.path === "chapter")).toBe(true);
  });

  it("rejects a topic outside the supplied chapter", () => {
    const otherChapter = "222222222222222222222222";
    const extended: HierarchyContext = {
      ...context,
      chapters: new Map([
        ...context.chapters,
        [otherChapter, { category: CATEGORY, subject: SUBJECT }],
      ]),
    };

    const issues = validateHierarchyRefs(
      { ...refs, chapter: otherChapter, topic: TOPIC },
      extended,
    );
    expect(issues.some((issue) => issue.path === "topic")).toBe(true);
  });
});

describe("answer key protection", () => {
  const doc = {
    _id: new Types.ObjectId(),
    question: { text: "What is force?" },
    type: "MCQ",
    status: "APPROVED",
    explanation: "Newton's second law.",
    answer: {
      text: "",
      correctOptions: ["A"],
      booleanAnswer: null,
      matchingPairs: [],
    },
    contentHash: "abc",
  } as unknown as QuestionDoc;

  it("strips the answer for an anonymous caller even when asked for", () => {
    const presented = presentQuestion(doc, { actor: null, requestAnswers: true });
    expect(presented.answer).toBeUndefined();
    expect(presented.answersIncluded).toBe(false);
  });

  it("strips the answer for a student even when asked for", () => {
    const presented = presentQuestion(doc, { actor: actor("student"), requestAnswers: true });
    expect(presented.answer).toBeUndefined();
    expect(presented.answersIncluded).toBe(false);
  });

  it("strips the answer for a teacher who did not ask for it", () => {
    const presented = presentQuestion(doc, { actor: actor("teacher"), requestAnswers: false });
    expect(presented.answer).toBeUndefined();
  });

  it("includes the answer only for a permitted role that asked", () => {
    const presented = presentQuestion(doc, { actor: actor("teacher"), requestAnswers: true });
    expect(presented.answer?.correctOptions).toEqual(["A"]);
    expect(presented.answersIncluded).toBe(true);
  });

  it("also withholds the explanation, which often restates the answer", () => {
    const presented = presentQuestion(doc, { actor: actor("student"), requestAnswers: true });
    expect(presented.explanation).toBe("");
  });

  it("never leaks the internal content hash", () => {
    const presented = presentQuestion(doc, { actor: actor("super_admin"), requestAnswers: true });
    expect("contentHash" in presented).toBe(false);
  });
});
