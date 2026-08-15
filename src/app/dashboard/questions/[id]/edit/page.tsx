import type { Metadata } from "next";
import { notFound } from "next/navigation";

import QuestionForm, { type QuestionFormValues } from "@/components/questions/QuestionForm";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { questionService } from "@/lib/services/question.service";
import type { QuestionType } from "@/types/question";

export const metadata: Metadata = { title: "Edit question" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface RefLike {
  _id?: unknown;
}

function refId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in (value as RefLike)) {
    return String((value as RefLike)._id ?? "");
  }
  return String(value);
}

export default async function EditQuestionPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  // Answers are requested so the form can be pre-filled; the service still
  // gates them on question:read-answers.
  const question = await questionService
    .getById(id, user, { requestAnswers: true })
    .catch(() => null);

  if (!question) notFound();

  const answer = question.answer;

  const initialValues: Partial<QuestionFormValues> = {
    category: refId(question.category),
    subject: refId(question.subject),
    chapter: refId(question.chapter),
    topic: refId(question.topic),
    board: refId(question.board),
    exam: refId(question.exam),
    type: (question.type ?? "MCQ") as QuestionType,
    difficulty: question.difficulty ?? "",
    language: question.language ?? "bn",
    text: question.question?.text ?? "",
    options:
      question.options && question.options.length > 0
        ? question.options.map((option) => ({ id: option.id, text: option.text }))
        : undefined,
    correctOptions: answer?.correctOptions ?? [],
    answerText: answer?.text ?? "",
    booleanAnswer:
      answer?.booleanAnswer === true ? "true" : answer?.booleanAnswer === false ? "false" : "",
    matchingPairs:
      answer?.matchingPairs && answer.matchingPairs.length > 0 ? answer.matchingPairs : undefined,
    explanation: question.explanation ?? "",
    marks: String(question.marks ?? 1),
    year: question.year ? String(question.year) : "",
    source: question.source ?? "",
    tags: (question.tags ?? []).join(", "),
    status: question.status ?? "DRAFT",
  };

  return (
    <QuestionForm
      mode="edit"
      questionId={id}
      initialValues={initialValues}
      canReview={can(user.role, "question:review")}
    />
  );
}
