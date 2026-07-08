"use client";

// ============================================================
// components/QuestionDistribution.tsx
// Per-chapter question type / difficulty / count / marks table
// ============================================================

import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type Chapter,
  type Difficulty,
  type DistributionRow,
  type QuestionType,
  type ValidationErrors,
} from "../types";

interface QuestionDistributionProps {
  selectedChapters: Chapter[];
  distribution: DistributionRow[];
  addDistributionRow: (chapterId: string) => void;
  updateDistributionRow: (
    rowId: string,
    patch: Partial<DistributionRow>,
  ) => void;
  removeDistributionRow: (rowId: string) => void;
  refreshRowQuestions: (rowId: string) => void;
  errors: ValidationErrors;
}

function StatusBadge({ row }: { row: DistributionRow }) {
  if (row.status === "loading") {
    return <span className="text-xs text-gray-500">Pulling questions...</span>;
  }
  if (row.status === "ok") {
    return (
      <span className="text-xs text-emerald-600 font-medium">
        ✓ {row.fetchedCount}/{row.count} auto-pulled
      </span>
    );
  }
  if (row.status === "insufficient") {
    return (
      <span className="text-xs text-amber-600 font-medium">
        মাত্র {row.fetchedCount}টি পাওয়া গেছে ({row.count} চেয়েছেন)
      </span>
    );
  }
  if (row.status === "error") {
    return (
      <span className="text-xs text-red-600 font-medium">
        {row.errorMessage || "Fetch failed"}
      </span>
    );
  }
  return <span className="text-xs text-gray-400">Waiting...</span>;
}

const selectClass =
  "border border-gray-400 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white text-sm";
const numberClass =
  "w-20 border border-gray-400 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white text-sm";

export default function QuestionDistribution({
  selectedChapters,
  distribution,
  addDistributionRow,
  updateDistributionRow,
  removeDistributionRow,
  refreshRowQuestions,
  errors,
}: QuestionDistributionProps) {
  return (
    <section className="bg-white rounded-2xl shadow p-6 space-y-5">
      <h2 className="text-lg font-bold text-black border-b pb-2">
        Question Distribution
      </h2>

      {selectedChapters.length === 0 && (
        <p className="text-sm text-gray-500">
          প্রথমে উপরে থেকে Chapter select করুন
        </p>
      )}

      {selectedChapters.map((chapter) => {
        const rows = distribution.filter(
          (row) => row.chapterId === chapter._id,
        );
        return (
          <div
            key={chapter._id}
            className="border border-gray-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-black">{chapter.name}</h3>
              <button
                type="button"
                onClick={() => addDistributionRow(chapter._id)}
                className="text-sm text-purple-600 font-semibold hover:underline"
              >
                + Add Row
              </button>
            </div>

            {rows.length === 0 && (
              <p className="text-xs text-gray-500">
                এই Chapter-এর জন্য কোনো distribution row নেই
              </p>
            )}

            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-3">Difficulty</th>
                      <th className="py-2 pr-3">Question Type</th>
                      <th className="py-2 pr-3">Count</th>
                      <th className="py-2 pr-3">Marks / Q</th>
                      <th className="py-2 pr-3">Subtotal</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="py-2 pr-3">
                          <select
                            className={selectClass}
                            value={row.difficulty}
                            onChange={(e) =>
                              updateDistributionRow(row.id, {
                                difficulty: e.target.value as Difficulty,
                              })
                            }
                          >
                            {Object.entries(DIFFICULTY_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            className={selectClass}
                            value={row.questionType}
                            onChange={(e) =>
                              updateDistributionRow(row.id, {
                                questionType: e.target.value as QuestionType,
                              })
                            }
                          >
                            {Object.entries(QUESTION_TYPE_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={1}
                            className={numberClass}
                            value={row.count}
                            onChange={(e) =>
                              updateDistributionRow(row.id, {
                                count: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            className={numberClass}
                            value={row.marksPerQuestion}
                            onChange={(e) =>
                              updateDistributionRow(row.id, {
                                marksPerQuestion: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="py-2 pr-3 text-black font-semibold">
                          {(row.count * row.marksPerQuestion).toFixed(1)}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeDistributionRow(row.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-2 space-y-1">
                  {rows.map((row) => (
                    <div
                      key={`status_${row.id}`}
                      className="flex items-center justify-between"
                    >
                      <StatusBadge row={row} />
                      <button
                        type="button"
                        onClick={() => refreshRowQuestions(row.id)}
                        disabled={row.status === "loading"}
                        className="text-xs text-purple-600 hover:underline disabled:opacity-50"
                      >
                        Re-randomize
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {errors.distribution && (
        <p className="text-xs text-red-600">{errors.distribution}</p>
      )}
      {errors.marksMismatch && (
        <p className="text-xs text-amber-600">{errors.marksMismatch}</p>
      )}
    </section>
  );
}
