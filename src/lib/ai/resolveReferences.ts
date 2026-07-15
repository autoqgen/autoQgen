import Category from "@/models/Category";
import Subject from "@/models/Subject";
import Chapter from "@/models/Chapter";
import Topic from "@/models/Topic";
import Board from "@/models/Board";
import Exam from "@/models/Exam";
import type { ExtractedFilters } from "./types";

/**
 * Groq extracts human-readable names ("Physics", "Force", "Dhaka Board").
 * MongoDB stores ObjectId references. This helper is the bridge between
 * the two — it looks each name up in the relevant collection (case
 * insensitive, partial match) and returns the matching _id, or null if
 * nothing matched.
 *
 * This runs entirely on the backend. The AI never sees or produces
 * ObjectIds and never builds Mongo queries itself.
 */

interface ResolvedReferences {
  categoryId: string | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
  boardId: string | null;
  examId: string | null;
  unresolved: string[];
}

function nameRegex(value: string): RegExp {
  const escaped = value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

export async function resolveReferences(
  filters: ExtractedFilters,
): Promise<ResolvedReferences> {
  const unresolved: string[] = [];

  let categoryId: string | null = null;
  let subjectId: string | null = null;
  let chapterId: string | null = null;
  let topicId: string | null = null;
  let boardId: string | null = null;
  let examId: string | null = null;

  if (filters.category) {
    const doc = await Category.findOne({ name: nameRegex(filters.category) })
      .select("_id")
      .lean();
    if (doc) categoryId = String((doc as { _id: unknown })._id);
    else unresolved.push(`category: "${filters.category}"`);
  }

  if (filters.subject) {
    const query: Record<string, unknown> = { name: nameRegex(filters.subject) };
    if (categoryId) query.category = categoryId;
    const doc = await Subject.findOne(query).select("_id category").lean();
    if (doc) {
      subjectId = String((doc as { _id: unknown })._id);
      if (!categoryId) {
        const cat = (doc as { category?: unknown }).category;
        if (cat) categoryId = String(cat);
      }
    } else {
      unresolved.push(`subject: "${filters.subject}"`);
    }
  }

  if (filters.chapter) {
    const query: Record<string, unknown> = { name: nameRegex(filters.chapter) };
    if (subjectId) query.subject = subjectId;
    const doc = await Chapter.findOne(query).select("_id subject category").lean();
    if (doc) {
      chapterId = String((doc as { _id: unknown })._id);
      const d = doc as { subject?: unknown; category?: unknown };
      if (!subjectId && d.subject) subjectId = String(d.subject);
      if (!categoryId && d.category) categoryId = String(d.category);
    } else {
      unresolved.push(`chapter: "${filters.chapter}"`);
    }
  }

  if (filters.topic) {
    const query: Record<string, unknown> = { name: nameRegex(filters.topic) };
    if (chapterId) query.chapter = chapterId;
    const doc = await Topic.findOne(query).select("_id").lean();
    if (doc) topicId = String((doc as { _id: unknown })._id);
    else unresolved.push(`topic: "${filters.topic}"`);
  }

  if (filters.board) {
    const doc = await Board.findOne({ name: nameRegex(filters.board) })
      .select("_id")
      .lean();
    if (doc) boardId = String((doc as { _id: unknown })._id);
    else unresolved.push(`board: "${filters.board}"`);
  }

  if (filters.exam) {
    const doc = await Exam.findOne({ name: nameRegex(filters.exam) })
      .select("_id")
      .lean();
    if (doc) examId = String((doc as { _id: unknown })._id);
    else unresolved.push(`exam: "${filters.exam}"`);
  }

  return { categoryId, subjectId, chapterId, topicId, boardId, examId, unresolved };
}

export default resolveReferences;
