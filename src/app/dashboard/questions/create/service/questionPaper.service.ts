// ============================================================
// service/questionPaper.service.ts
// All network calls for the Question Paper Builder.
// Uses the app's own Next.js /api routes (route handlers).
// No external host / localhost:5000 dependency.
// ============================================================

import type {
  Board,
  Category,
  Chapter,
  Difficulty,
  Exam,
  Question,
  QuestionPaperPayload,
  QuestionPaperResponse,
  QuestionType,
  Subject,
  Topic,
} from "../types";

// Base path for this app's internal API routes.
// Override with NEXT_PUBLIC_API_URL only if you proxy /api elsewhere
// (e.g. NEXT_PUBLIC_API_URL="/api"). Defaults to the local Next.js API.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body, ignore
  }

  if (!res.ok) {
    const message =
      body?.message || body?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  // Support both { data: [...] } and raw array/object responses
  return (body?.data ?? body) as T;
}

// ---------------- Dropdown / Reference Data ----------------

export function fetchCategories(): Promise<Category[]> {
  return request<Category[]>("/categories");
}

export function fetchSubjects(categoryId: string): Promise<Subject[]> {
  return request<Subject[]>(
    `/subjects?category=${encodeURIComponent(categoryId)}`,
  );
}

export function fetchChapters(subjectId: string): Promise<Chapter[]> {
  return request<Chapter[]>(
    `/chapters?subject=${encodeURIComponent(subjectId)}`,
  );
}

export function fetchTopics(chapterId: string): Promise<Topic[]> {
  return request<Topic[]>(`/topics?chapter=${encodeURIComponent(chapterId)}`);
}

export function fetchBoards(): Promise<Board[]> {
  return request<Board[]>("/boards");
}

export function fetchExams(): Promise<Exam[]> {
  return request<Exam[]>("/exams");
}

// ---------------- Question Bank (auto-pull) ----------------

export interface RandomQuestionFilter {
  chapter: string;
  difficulty: Difficulty;
  type: QuestionType;
  count: number;
}

/**
 * Pulls up to `count` random questions matching chapter + difficulty + type
 * from the app's own question bank (/api/questions).
 *
 * Expects the route to support: chapter, difficulty, type, limit, random=true
 * Adjust the query params below if your /api/questions route differs.
 */
export function fetchRandomQuestions({
  chapter,
  difficulty,
  type,
  count,
}: RandomQuestionFilter): Promise<Question[]> {
  const params = new URLSearchParams({
    chapter,
    difficulty,
    type,
    limit: String(count),
    random: "true",
  });
  return request<Question[]>(`/questions?${params.toString()}`);
}

// ---------------- Question Paper CRUD ----------------

export function createQuestionPaper(
  payload: QuestionPaperPayload,
): Promise<QuestionPaperResponse> {
  return request<QuestionPaperResponse>("/question-papers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateQuestionPaper(
  id: string,
  payload: QuestionPaperPayload,
): Promise<QuestionPaperResponse> {
  return request<QuestionPaperResponse>(
    `/question-papers/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function fetchQuestionPaper(
  id: string,
): Promise<QuestionPaperResponse> {
  return request<QuestionPaperResponse>(
    `/question-papers/${encodeURIComponent(id)}`,
  );
}

export { ApiError };