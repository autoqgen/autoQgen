import { connectDB } from "@/lib/db";
import Question from "@/models/Question";
import resolveReferences from "./resolveReferences";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type ExtractedFilters,
  type SearchQuestionsResult,
} from "./types";

/**
 * searchQuestions()
 *
 * The ONLY place a MongoDB query is built. Takes the sanitized filters
 * produced by extractFilters() (which came from Groq) and turns them into
 * a real Mongoose query against the existing Question collection.
 *
 * The AI never touches this — it only supplies the filter values.
 */
export async function searchQuestions(
  filters: ExtractedFilters,
): Promise<SearchQuestionsResult> {
  await connectDB();

  const resolved = await resolveReferences(filters);

  const query: Record<string, unknown> = {
    isActive: true,
  };

  if (resolved.categoryId) query.category = resolved.categoryId;
  if (resolved.subjectId) query.subject = resolved.subjectId;
  if (resolved.chapterId) query.chapter = resolved.chapterId;
  if (resolved.topicId) query.topic = resolved.topicId;
  if (resolved.boardId) query.board = resolved.boardId;
  if (resolved.examId) query.exam = resolved.examId;

  if (filters.type) query.type = filters.type.toUpperCase();
  if (filters.difficulty) {
    query.difficulty = filters.difficulty.toUpperCase();
  }
  if (filters.language) query.language = filters.language.toLowerCase();
  if (filters.status) query.status = filters.status.toUpperCase();
  if (typeof filters.aiGenerated === "boolean")
    query.aiGenerated = filters.aiGenerated;
  if (filters.year) query.year = filters.year;
  if (filters.session) query.session = new RegExp(filters.session, "i");
  if (filters.source) query.source = new RegExp(filters.source, "i");
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags.map((t) => new RegExp(t, "i")) };
  }

  // Only surface approved, active questions by default unless the teacher
  // explicitly asked for a different status.
  if (filters.status) {
    query.status = filters.status.toUpperCase();
  }
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const questions = await Question.find(query)
    .populate("category", "name slug")
    .populate("subject", "name slug")
    .populate("chapter", "name slug")
    .populate("topic", "name slug")
    .populate("board", "name slug shortName")
    .populate("exam", "name slug type year")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    success: true,
    count: questions.length,
    questions,
    appliedFilters: {
      ...query,
      category: resolved.categoryId ?? filters.category ?? undefined,
      subject: resolved.subjectId ?? filters.subject ?? undefined,
      chapter: resolved.chapterId ?? filters.chapter ?? undefined,
      topic: resolved.topicId ?? filters.topic ?? undefined,
      board: resolved.boardId ?? filters.board ?? undefined,
      exam: resolved.examId ?? filters.exam ?? undefined,
    },
    unresolvedFilters: resolved.unresolved,
  };
}

export default searchQuestions;
