"use client";

import { Badge, Card } from "@/components/ui";
import type { QuestionFormValues } from "@/components/questions/QuestionForm";

/**
 * Renders the in-progress question the way a student would see it, plus the
 * answer block a teacher would see. Purely presentational — no fetching.
 */
export default function QuestionPreview({ values }: { values: QuestionFormValues }) {
  const answerLine = (() => {
    if (values.correctOptions.length > 0) return values.correctOptions.join(", ");
    if (values.type === "TRUE_FALSE" && values.booleanAnswer !== "") {
      return values.booleanAnswer === "true" ? "True" : "False";
    }
    if (values.type === "MATCHING") {
      return values.matchingPairs
        .filter((pair) => pair.left && pair.right)
        .map((pair) => `${pair.left} → ${pair.right}`)
        .join("; ");
    }
    return values.answerText;
  })();

  return (
    <Card className="border-brand-100 bg-brand-50/40">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{values.type.replace(/_/g, " ")}</Badge>
        {values.difficulty ? <Badge>{values.difficulty}</Badge> : null}
        <Badge>{values.marks || 1} mark(s)</Badge>
        <Badge tone="slate">{values.language === "bn" ? "Bangla" : "English"}</Badge>
      </div>

      <p className="mt-4 text-sm text-slate-900">
        {values.text || <span className="text-slate-400">Question text will appear here.</span>}
      </p>

      {values.options.some((option) => option.text) ? (
        <ul className="mt-3 flex flex-col gap-1">
          {values.options
            .filter((option) => option.text)
            .map((option) => (
              <li key={option.id} className="text-sm text-slate-700">
                ({option.id}) {option.text}
              </li>
            ))}
        </ul>
      ) : null}

      {values.type === "MATCHING" ? (
        <ul className="mt-3 flex flex-col gap-1">
          {values.matchingPairs
            .filter((pair) => pair.left || pair.right)
            .map((pair, index) => (
              <li key={index} className="text-sm text-slate-700">
                {pair.left} — {pair.right}
              </li>
            ))}
        </ul>
      ) : null}

      <div className="mt-4 rounded-lg bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Answer (staff view)
        </p>
        <p className="mt-1 text-sm text-slate-800">
          {answerLine || <span className="text-slate-400">Not set</span>}
        </p>
        {values.explanation ? (
          <p className="mt-2 text-xs text-slate-600">{values.explanation}</p>
        ) : null}
      </div>
    </Card>
  );
}
