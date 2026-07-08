"use client";

// ============================================================
// components/PreviewCard.tsx
// Live read-only summary of the paper being built
// ============================================================

import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type BasicInfoState,
  type Board,
  type Category,
  type Chapter,
  type DistributionRow,
  type Exam,
  type PaperSettingsState,
  type Subject,
} from "../types";

interface PreviewCardProps {
  basicInfo: BasicInfoState;
  settings: PaperSettingsState;
  selectedChapters: Chapter[];
  distribution: DistributionRow[];
  categories: Category[];
  subjects: Subject[];
  boards: Board[];
  exams: Exam[];
  totals: { totalQuestions: number; totalMarks: number };
}

function nameOf<T extends { _id: string; name: string }>(
  list: T[],
  id: string,
): string {
  return list.find((item) => item._id === id)?.name || "—";
}

export default function PreviewCard({
  basicInfo,
  settings,
  selectedChapters,
  distribution,
  categories,
  subjects,
  boards,
  exams,
  totals,
}: PreviewCardProps) {
  const marksMismatch =
    distribution.length > 0 && totals.totalMarks !== settings.totalMarks;

  return (
    <section className="bg-white rounded-2xl shadow p-6 space-y-5 sticky top-6">
      <h2 className="text-lg font-bold text-black border-b pb-2">Preview</h2>

      <div>
        <p className="text-sm text-gray-500">Title</p>
        <p className="text-black font-semibold">
          {basicInfo.title || "Untitled Paper"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Category</p>
          <p className="text-black font-medium">
            {nameOf(categories, basicInfo.categoryId)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Subject</p>
          <p className="text-black font-medium">
            {nameOf(subjects, basicInfo.subjectId)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Board</p>
          <p className="text-black font-medium">
            {basicInfo.boardId ? nameOf(boards, basicInfo.boardId) : "—"}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Exam</p>
          <p className="text-black font-medium">
            {basicInfo.examId ? nameOf(exams, basicInfo.examId) : "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-1">Chapters</p>
        {selectedChapters.length === 0 ? (
          <p className="text-sm text-black">—</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedChapters.map((c) => (
              <span
                key={c._id}
                className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-full"
              >
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-1">Distribution</p>
        {distribution.length === 0 ? (
          <p className="text-sm text-black">—</p>
        ) : (
          <ul className="text-xs text-black space-y-1 max-h-40 overflow-y-auto pr-1">
            {distribution.map((row) => (
              <li key={row.id} className="flex justify-between items-center">
                <span>
                  {QUESTION_TYPE_LABELS[row.questionType]} ·{" "}
                  {DIFFICULTY_LABELS[row.difficulty]} ×{" "}
                  {row.status === "ok" || row.status === "insufficient"
                    ? `${row.fetchedCount}/${row.count}`
                    : row.count}
                  {row.status === "loading" && (
                    <span className="text-gray-400"> (pulling...)</span>
                  )}
                  {row.status === "insufficient" && (
                    <span className="text-amber-600"> ⚠</span>
                  )}
                  {row.status === "error" && (
                    <span className="text-red-600"> ✕</span>
                  )}
                </span>
                <span className="font-semibold">
                  {(row.count * row.marksPerQuestion).toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t pt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm text-gray-500">Total Questions</p>
          <p className="text-xl font-bold text-black">
            {totals.totalQuestions}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Marks</p>
          <p
            className={`text-xl font-bold ${
              marksMismatch ? "text-amber-600" : "text-black"
            }`}
          >
            {totals.totalMarks} / {settings.totalMarks}
          </p>
        </div>
      </div>

      {marksMismatch && (
        <p className="text-xs text-amber-600">
          Distribution অনুযায়ী মোট Marks Total Marks সেটিংসের সাথে মিলছে না
        </p>
      )}

      <div className="border-t pt-4 text-sm text-black">
        <p>Duration: {settings.durationMinutes} min</p>
        {settings.negativeMarking && (
          <p>Negative Marking: -{settings.negativeMarkValue} per wrong</p>
        )}
      </div>
    </section>
  );
}
