"use client";

// ============================================================
// components/PaperSettings.tsx
// ============================================================

import type { PaperSettingsState, ValidationErrors } from "../types";

interface PaperSettingsProps {
  settings: PaperSettingsState;
  updateSettings: <K extends keyof PaperSettingsState>(
    key: K,
    value: PaperSettingsState[K],
  ) => void;
  errors: ValidationErrors;
}

const inputClass =
  "w-full border border-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white";
const labelClass = "block text-sm font-semibold text-black mb-2";
const errorClass = "text-xs text-red-600 mt-1";

export default function PaperSettings({
  settings,
  updateSettings,
  errors,
}: PaperSettingsProps) {
  return (
    <section className="bg-white rounded-2xl shadow p-6 space-y-5">
      <h2 className="text-lg font-bold text-black border-b pb-2">
        Paper Settings
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className={labelClass}>Total Marks *</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={settings.totalMarks}
            onChange={(e) =>
              updateSettings("totalMarks", Number(e.target.value))
            }
          />
          {errors.totalMarks && (
            <p className={errorClass}>{errors.totalMarks}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Duration (minutes) *</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={settings.durationMinutes}
            onChange={(e) =>
              updateSettings("durationMinutes", Number(e.target.value))
            }
          />
          {errors.durationMinutes && (
            <p className={errorClass}>{errors.durationMinutes}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Negative Mark Value</label>
          <input
            type="number"
            min={0}
            step={0.05}
            className={inputClass}
            value={settings.negativeMarkValue}
            disabled={!settings.negativeMarking}
            onChange={(e) =>
              updateSettings("negativeMarkValue", Number(e.target.value))
            }
          />
          {errors.negativeMarkValue && (
            <p className={errorClass}>{errors.negativeMarkValue}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-6 pt-1">
        <label className="flex items-center gap-2 text-black text-sm font-medium">
          <input
            type="checkbox"
            className="w-5 h-5 accent-purple-600"
            checked={settings.negativeMarking}
            onChange={(e) =>
              updateSettings("negativeMarking", e.target.checked)
            }
          />
          Negative Marking
        </label>

        <label className="flex items-center gap-2 text-black text-sm font-medium">
          <input
            type="checkbox"
            className="w-5 h-5 accent-purple-600"
            checked={settings.shuffleQuestions}
            onChange={(e) =>
              updateSettings("shuffleQuestions", e.target.checked)
            }
          />
          Shuffle Questions
        </label>

        <label className="flex items-center gap-2 text-black text-sm font-medium">
          <input
            type="checkbox"
            className="w-5 h-5 accent-purple-600"
            checked={settings.showAnswerKey}
            onChange={(e) => updateSettings("showAnswerKey", e.target.checked)}
          />
          Show Answer Key
        </label>
      </div>

      <div>
        <label className={labelClass}>Instructions</label>
        <textarea
          rows={3}
          className={inputClass}
          placeholder="পরীক্ষার্থীদের জন্য নির্দেশনা লিখুন..."
          value={settings.instructions}
          onChange={(e) => updateSettings("instructions", e.target.value)}
        />
      </div>
    </section>
  );
}
