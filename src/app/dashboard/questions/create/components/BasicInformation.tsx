"use client";

// ============================================================
// components/BasicInformation.tsx
// ============================================================

import type {
  BasicInfoState,
  Board,
  Category,
  Exam,
  Language,
  Subject,
  ValidationErrors,
} from "../types";

interface BasicInformationProps {
  basicInfo: BasicInfoState;
  updateBasicInfo: <K extends keyof BasicInfoState>(
    key: K,
    value: BasicInfoState[K],
  ) => void;
  categories: Category[];
  subjects: Subject[];
  boards: Board[];
  exams: Exam[];
  loadingSubjects: boolean;
  errors: ValidationErrors;
}

const inputClass =
  "w-full border border-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-gray-100 disabled:cursor-not-allowed";
const labelClass = "block text-sm font-semibold text-black mb-2";
const errorClass = "text-xs text-red-600 mt-1";

export default function BasicInformation({
  basicInfo,
  updateBasicInfo,
  categories,
  subjects,
  boards,
  exams,
  loadingSubjects,
  errors,
}: BasicInformationProps) {
  return (
    <section className="bg-white rounded-2xl shadow p-6 space-y-5">
      <h2 className="text-lg font-bold text-black border-b pb-2">
        Basic Information
      </h2>

      <div>
        <label className={labelClass}>Paper Title *</label>
        <input
          type="text"
          className={inputClass}
          placeholder="যেমনঃ HSC Physics 1st Paper - Model Test 01"
          value={basicInfo.title}
          onChange={(e) => updateBasicInfo("title", e.target.value)}
        />
        {errors.title && <p className={errorClass}>{errors.title}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Category */}
        <div>
          <label className={labelClass}>Category *</label>
          <select
            className={inputClass}
            value={basicInfo.categoryId}
            onChange={(e) => updateBasicInfo("categoryId", e.target.value)}
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className={errorClass}>{errors.categoryId}</p>
          )}
        </div>

        {/* Subject */}
        <div>
          <label className={labelClass}>Subject *</label>
          <select
            className={inputClass}
            value={basicInfo.subjectId}
            onChange={(e) => updateBasicInfo("subjectId", e.target.value)}
            disabled={!basicInfo.categoryId}
          >
            <option value="">
              {!basicInfo.categoryId
                ? "প্রথমে Category select করুন"
                : loadingSubjects
                  ? "Loading..."
                  : "Select Subject"}
            </option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.subjectId && <p className={errorClass}>{errors.subjectId}</p>}
        </div>

        {/* Board */}
        <div>
          <label className={labelClass}>Board</label>
          <select
            className={inputClass}
            value={basicInfo.boardId}
            onChange={(e) => updateBasicInfo("boardId", e.target.value)}
          >
            <option value="">Select Board</option>
            {boards.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Exam */}
        <div>
          <label className={labelClass}>Exam</label>
          <select
            className={inputClass}
            value={basicInfo.examId}
            onChange={(e) => updateBasicInfo("examId", e.target.value)}
          >
            <option value="">Select Exam</option>
            {exams.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        {/* Class / Level */}
        <div>
          <label className={labelClass}>Class / Level</label>
          <input
            type="text"
            className={inputClass}
            placeholder="যেমনঃ HSC, Class 9-10"
            value={basicInfo.classLevel}
            onChange={(e) => updateBasicInfo("classLevel", e.target.value)}
          />
        </div>

        {/* Session */}
        <div>
          <label className={labelClass}>Session</label>
          <input
            type="text"
            className={inputClass}
            placeholder="যেমনঃ 2025-2026"
            value={basicInfo.session}
            onChange={(e) => updateBasicInfo("session", e.target.value)}
          />
        </div>

        {/* Language */}
        <div>
          <label className={labelClass}>Language</label>
          <select
            className={inputClass}
            value={basicInfo.language}
            onChange={(e) =>
              updateBasicInfo("language", e.target.value as Language)
            }
          >
            <option value="bn">Bangla</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    </section>
  );
}
