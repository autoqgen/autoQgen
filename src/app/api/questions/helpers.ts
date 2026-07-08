import { QuestionType } from "@/types/question";

/* ==========================================
   Normalize Options
========================================== */

export function normalizeOptions(options: any[]) {
  if (!Array.isArray(options)) return [];

  return options
    .filter((opt) => opt?.id && opt?.text)
    .map((opt) => ({
      id: opt.id.toUpperCase().trim(),
      text: opt.text.trim(),
      image: opt.image || "",
      explanation: opt.explanation || "",
    }));
}

/* ==========================================
   Normalize Answer
========================================== */

export function normalizeAnswer(answer: any) {
  if (!answer) return answer;

  return {
    text: answer.text?.trim() || "",

    correctOptions: Array.isArray(answer.correctOptions)
      ? answer.correctOptions.map((o: string) => o.toUpperCase())
      : [],

    booleanAnswer:
      typeof answer.booleanAnswer === "boolean" ? answer.booleanAnswer : null,

    matchingPairs: Array.isArray(answer.matchingPairs)
      ? answer.matchingPairs
      : [],

    extra: answer.extra || null,
  };
}

/* ==========================================
   Normalize Question
========================================== */

export function normalizeQuestion(question: any) {
  return {
    text: question?.text?.trim() || "",
    image: question?.image || "",
    audio: question?.audio || "",
    video: question?.video || "",
    passage: question?.passage || "",
    latex: question?.latex || "",
  };
}

/* ==========================================
   Type Validation
========================================== */

export function validateTypeSafety(type: string) {
  const allowedTypes = Object.values(QuestionType);

  if (!allowedTypes.includes(type as any)) {
    throw new Error("Invalid question type.");
  }
}

/* ==========================================
   Prepare Payload
========================================== */

export function prepareQuestionPayload(data: any) {
  validateTypeSafety(data.type);

  return {
    ...data,

    question: normalizeQuestion(data.question),

    options: normalizeOptions(data.options),

    answer: normalizeAnswer(data.answer),

    tags: Array.isArray(data.tags)
      ? data.tags.map((tag: string) => tag.trim())
      : [],
  };
}
