"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, Badge, Card, Field, Select, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { DIFFICULTIES, LANGUAGES, QUESTION_TYPES } from "@/types/question";

/**
 * Sidebar filter panel for an AUTO paper, reachable from its own detail page.
 *
 * Every field is live: changing any of them debounces a dry-run against the
 * new blueprint and, once it settles, writes the result straight back onto
 * the paper. There is no separate "apply" step — the paper always reflects
 * whatever the sidebar currently says. The paper keeps its id, status and
 * history; only the question selection and totals change.
 */

const DEBOUNCE_MS = 700;

interface TaxonomyOption {
  _id: string;
  name: string;
}

interface GenerationWarning {
  code: string;
  message: string;
}

interface GenerationPreview {
  requested: number;
  selected: number;
  totalMarks: number;
  warnings: GenerationWarning[];
  questions: { id: string; type: string; difficulty: string | null; marks: number }[];
}

export interface RegenerateSpec {
  category: string;
  subject: string;
  board: string | null;
  exam: string | null;
  language: string | null;
  chapters: string[];
  totalQuestions: number;
  totalMarks: number | null;
  difficultyDistribution: { difficulty: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
}

interface Props {
  paperId: string;
  initial: RegenerateSpec;
}

export default function RegeneratePanel({ paperId, initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [board, setBoard] = useState(initial.board ?? "");
  const [exam, setExam] = useState(initial.exam ?? "");
  const [language, setLanguage] = useState(initial.language ?? "");
  const [totalQuestions, setTotalQuestions] = useState(String(initial.totalQuestions || 10));
  const [totalMarks, setTotalMarks] = useState(initial.totalMarks ? String(initial.totalMarks) : "");
  const [selectedChapters, setSelectedChapters] = useState<string[]>(initial.chapters);
  const [difficultyQuota, setDifficultyQuota] = useState<Record<string, string>>(
    Object.fromEntries(initial.difficultyDistribution.map((q) => [q.difficulty, String(q.count)])),
  );
  const [typeQuota, setTypeQuota] = useState<Record<string, string>>(
    Object.fromEntries(initial.typeDistribution.map((q) => [q.type, String(q.count)])),
  );

  const [boards, setBoards] = useState<TaxonomyOption[]>([]);
  const [exams, setExams] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);

  const [preview, setPreview] = useState<GenerationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      const [boardResult, examResult, chapterResult] = await Promise.all([
        apiFetch<TaxonomyOption[]>("/api/boards?limit=100"),
        apiFetch<TaxonomyOption[]>("/api/exams?limit=100"),
        apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${initial.subject}`),
      ]);
      if (boardResult.success) setBoards(boardResult.data);
      if (examResult.success) setExams(examResult.data);
      if (chapterResult.success) setChapters(chapterResult.data);
    }
    void load();
    // Only ever loads for the fixed subject this paper belongs to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function spec() {
    return {
      category: initial.category,
      subject: initial.subject,
      chapters: selectedChapters,
      topics: [],
      board: board || null,
      exam: exam || null,
      year: null,
      language: language || null,
      totalQuestions: Number(totalQuestions) || 0,
      totalMarks: totalMarks ? Number(totalMarks) : null,
      difficultyDistribution: Object.entries(difficultyQuota)
        .filter(([, value]) => Number(value) > 0)
        .map(([difficulty, value]) => ({ difficulty, count: Number(value) })),
      typeDistribution: Object.entries(typeQuota)
        .filter(([, value]) => Number(value) > 0)
        .map(([type, value]) => ({ type, count: Number(value) })),
      status: "APPROVED",
    };
  }

  async function regenerate() {
    setBusy(true);
    setError("");
    setErrors({});
    setNotice("");

    const dryRunResult = await apiFetch<GenerationPreview>("/api/papers/generate", {
      method: "PUT",
      json: spec(),
    });

    if (!dryRunResult.success) {
      setBusy(false);
      setErrors(fieldErrors(dryRunResult));
      setError(dryRunResult.error.message);
      return;
    }

    setPreview(dryRunResult.data);

    const updateResult = await apiFetch(`/api/papers/${paperId}`, {
      method: "PUT",
      json: {
        subject: initial.subject,
        board: board || null,
        exam: exam || null,
        sections: [
          {
            title: "",
            instructions: "",
            order: 0,
            questions: dryRunResult.data.questions.map((question, index) => ({
              question: question.id,
              order: index,
              marks: question.marks,
            })),
          },
        ],
      },
    });

    setBusy(false);

    if (!updateResult.success) {
      setError(updateResult.error.message);
      toast.error(updateResult.error.message);
      return;
    }

    setNotice("Saved.");
    toast.success("Paper blueprint updated!");
    router.refresh();
  }

  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (selectedChapters.length === 0) return;

    const timer = setTimeout(() => void regenerate(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    board,
    exam,
    language,
    totalQuestions,
    totalMarks,
    selectedChapters,
    difficultyQuota,
    typeQuota,
  ]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Regenerate</h2>
        {busy ? <Spinner label="Saving" /> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Every change here saves straight back onto the paper — no separate step.
      </p>

      {error ? <div className="mt-3"><Alert tone="error">{error}</Alert></div> : null}
      {notice ? <div className="mt-3"><Alert tone="success">{notice}</Alert></div> : null}

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-slate-700">Chapters</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chapters.map((chapter) => {
              const active = selectedChapters.includes(chapter._id);
              return (
                <button
                  key={chapter._id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedChapters((previous) =>
                      active
                        ? previous.filter((id) => id !== chapter._id)
                        : [...previous, chapter._id],
                    )
                  }
                  className={`rounded-md px-2 py-1 text-xs ${
                    active
                      ? "bg-brand-600 text-white"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {chapter.name}
                </button>
              );
            })}
          </div>
          {errors.chapters ? <p className="mt-1 text-xs text-red-600">{errors.chapters}</p> : null}
        </div>

        <Field label="Board">
          {({ id }) => (
            <Select id={id} value={board} onChange={(event) => setBoard(event.target.value)}>
              <option value="">None</option>
              {boards.map((option) => (
                <option key={option._id} value={option._id}>{option.name}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Exam">
          {({ id }) => (
            <Select id={id} value={exam} onChange={(event) => setExam(event.target.value)}>
              <option value="">None</option>
              {exams.map((option) => (
                <option key={option._id} value={option._id}>{option.name}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Language">
          {({ id }) => (
            <Select id={id} value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="">Any</option>
              {LANGUAGES.map((value) => (
                <option key={value} value={value}>{value === "bn" ? "Bangla" : "English"}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Total questions" error={errors.totalQuestions}>
          {({ id }) => (
            <TextInput
              id={id}
              type="number"
              min={1}
              value={totalQuestions}
              onChange={(event) => setTotalQuestions(event.target.value)}
            />
          )}
        </Field>

        <Field label="Target total marks" hint="Optional.">
          {({ id }) => (
            <TextInput
              id={id}
              type="number"
              value={totalMarks}
              onChange={(event) => setTotalMarks(event.target.value)}
            />
          )}
        </Field>

        <div>
          <p className="text-xs font-medium text-slate-700">Difficulty distribution</p>
          {errors.difficultyDistribution ? (
            <p className="mt-1 text-xs text-red-600">{errors.difficultyDistribution}</p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DIFFICULTIES.map((value) => (
              <Field key={value} label={value}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={0}
                    value={difficultyQuota[value] ?? ""}
                    onChange={(event) =>
                      setDifficultyQuota((previous) => ({ ...previous, [value]: event.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-700">Question type distribution</p>
          {errors.typeDistribution ? (
            <p className="mt-1 text-xs text-red-600">{errors.typeDistribution}</p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {QUESTION_TYPES.slice(0, 6).map((value) => (
              <Field key={value} label={value.replace(/_/g, " ")}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={0}
                    value={typeQuota[value] ?? ""}
                    onChange={(event) =>
                      setTypeQuota((previous) => ({ ...previous, [value]: event.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        </div>

        {preview ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone={preview.selected === preview.requested ? "green" : "amber"}>
              {preview.selected} of {preview.requested} selected
            </Badge>
            <Badge>{preview.totalMarks} mark(s)</Badge>
          </div>
        ) : null}

        {preview && preview.warnings.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {preview.warnings.map((warning, index) => (
              <li key={index} className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                {warning.message}
              </li>
            ))}
          </ul>
        ) : null}

        {selectedChapters.length === 0 ? (
          <p className="text-xs text-slate-500">Select at least one chapter to regenerate.</p>
        ) : null}
      </div>
    </Card>
  );
}
