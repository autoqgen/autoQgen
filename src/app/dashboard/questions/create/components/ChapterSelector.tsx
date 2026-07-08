"use client";

// ============================================================
// components/ChapterSelector.tsx
// ============================================================

import type { Chapter, ValidationErrors } from "../types";

interface ChapterSelectorProps {
  chapters: Chapter[];
  selectedChapterIds: string[];
  toggleChapter: (chapterId: string) => void;
  loadingChapters: boolean;
  subjectSelected: boolean;
  errors: ValidationErrors;
}

export default function ChapterSelector({
  chapters,
  selectedChapterIds,
  toggleChapter,
  loadingChapters,
  subjectSelected,
  errors,
}: ChapterSelectorProps) {
  return (
    <section className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-lg font-bold text-black">Chapter Selection</h2>
        <span className="text-sm text-gray-500">
          {selectedChapterIds.length} selected
        </span>
      </div>

      {!subjectSelected && (
        <p className="text-sm text-gray-500">
          প্রথমে Subject select করুন Chapter list দেখতে
        </p>
      )}

      {subjectSelected && loadingChapters && (
        <p className="text-sm text-gray-500">Loading chapters...</p>
      )}

      {subjectSelected && !loadingChapters && chapters.length === 0 && (
        <p className="text-sm text-gray-500">
          এই Subject-এ কোনো Chapter পাওয়া যায়নি
        </p>
      )}

      {chapters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {chapters.map((chapter) => {
            const checked = selectedChapterIds.includes(chapter._id);
            return (
              <label
                key={chapter._id}
                className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition ${
                  checked
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-purple-600"
                  checked={checked}
                  onChange={() => toggleChapter(chapter._id)}
                />
                <span className="text-black text-sm font-medium">
                  {chapter.name}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {errors.chapters && (
        <p className="text-xs text-red-600">{errors.chapters}</p>
      )}
    </section>
  );
}
