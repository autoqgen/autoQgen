"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, Button, Card, Field, Select, Spinner, TextInput, UnsavedChangesModal, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { DIFFICULTIES, QUESTION_TYPES } from "@/types/question";

/**
 * Smart question generation.
 *
 * The teacher says how many questions they want and, optionally, how they'd
 * like them spread across difficulty, type, chapters and previously-used
 * questions. Every distribution is a soft goal: the server picks the best
 * available matches from the current organization's approved bank and always
 * returns the requested total when enough eligible questions exist.
 */

const GEN_TYPES = QUESTION_TYPES.slice(0, 6);
const PAPER_TYPE_OPTIONS = [
  { value: "MODEL_TEST", label: "Model Test" },
  { value: "EXAM", label: "Exam" },
  { value: "PRACTICE_TEST", label: "Practice Test" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "OTHER", label: "Other" },
] as const;
const PREV_RANGE_OPTIONS = [
  { value: "1", label: "Last 1 paper" },
  { value: "2", label: "Last 2 papers" },
  { value: "3", label: "Last 3 papers" },
  { value: "5", label: "Last 5 papers" },
  { value: "10", label: "Last 10 papers" },
  { value: "0", label: "All previous papers" },
];

interface TaxonomyOption {
  _id: string;
  name: string;
}
interface PickerQuestion {
  _id: string;
  question: { text: string };
  type: string;
  difficulty: string | null;
}
interface GenWarning {
  code: string;
  message: string;
}
interface GenResult {
  requested: number;
  selected: number;
  eligibleCount: number;
  previousUsedCount: number;
  previousAllowed: number;
  difficultyRequested: Record<string, number>;
  difficultyActual: Record<string, number>;
  typeRequested: Record<string, number>;
  typeActual: Record<string, number>;
  warnings: GenWarning[];
}

type PctMap = Record<string, string>;

/** Largest-remainder split of `total` across the non-zero percentages. */
function distribute(pct: PctMap, total: number): { key: string; count: number }[] {
  const entries = Object.entries(pct)
    .map(([key, value]) => ({ key, pct: Number(value) || 0 }))
    .filter((e) => e.pct > 0);
  const sum = entries.reduce((s, e) => s + e.pct, 0);
  if (sum <= 0) return [];

  const raw = entries.map((e) => ({ key: e.key, exact: (e.pct / sum) * total }));
  const out = raw.map((r) => ({ key: r.key, count: Math.floor(r.exact) }));
  let assigned = out.reduce((s, r) => s + r.count, 0);
  const byRemainder = [...raw]
    .map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byRemainder) {
    if (assigned >= total) break;
    out[i]!.count += 1;
    assigned += 1;
  }
  return out.filter((r) => r.count > 0);
}

function countFor(pct: string, total: number): number {
  const value = Number(pct) || 0;
  return Math.round((value / 100) * total);
}

export default function PaperBuilder() {
  const router = useRouter();
  const toast = useToast();

  // --- paper details ---
  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState<string>("MODEL_TEST");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");

  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  // --- counts & distributions ---
  const [total, setTotal] = useState("25");
  const totalNum = Math.max(0, Number(total) || 0);

  const [difficultyPct, setDifficultyPct] = useState<PctMap>({ EASY: "40", MEDIUM: "40", HARD: "20", EXPERT: "" });
  const [typePct, setTypePct] = useState<PctMap>({});
  const [chapterMode, setChapterMode] = useState<"auto" | "custom">("auto");
  const [chapterPct, setChapterPct] = useState<PctMap>({});

  // --- previous questions ---
  const [prevMode, setPrevMode] = useState<"exclude" | "allow" | "prefer">("allow");
  const [prevPct, setPrevPct] = useState("20");
  const [prevRange, setPrevRange] = useState("5");
  const [excludeRecent, setExcludeRecent] = useState("2");

  // --- mandatory / excluded ---
  const [pool, setPool] = useState<PickerQuestion[]>([]);
  const [mandatoryIds, setMandatoryIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState<"mandatory" | "excluded" | null>(null);

  // --- randomization ---
  const [rndSelection, setRndSelection] = useState(true);
  const [rndOrder, setRndOrder] = useState(true);
  const [rndOptions, setRndOptions] = useState(true);

  // --- flow ---
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{ eligibleCount: number } | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [result, setResult] = useState<{ data: GenResult; paperId: string } | null>(null);

  const canGenerate = Boolean(title.trim() && category && subject && selectedChapters.length > 0 && totalNum > 0);
  const isDirty = Boolean(title.trim() || category || subject || selectedChapters.length > 0);

  /* -------------------------------- taxonomy ------------------------------- */

  useEffect(() => {
    void apiFetch<TaxonomyOption[]>("/api/categories?limit=100").then((r) => {
      if (r.success) setCategories(r.data);
    });
  }, []);

  useEffect(() => {
    if (!category) {
      queueMicrotask(() => setSubjects([]));
      return;
    }
    void apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${category}`).then((r) =>
      setSubjects(r.success ? r.data : []),
    );
  }, [category]);

  useEffect(() => {
    if (!subject) {
      queueMicrotask(() => {
        setChapters([]);
        setSelectedChapters([]);
        setPool([]);
      });
      return;
    }
    void apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subject}`).then((r) =>
      setChapters(r.success ? r.data : []),
    );
    void apiFetch<PickerQuestion[]>(`/api/questions?status=APPROVED&subject=${subject}&limit=100`).then((r) =>
      setPool(r.success ? r.data : []),
    );
  }, [subject]);

  /* --------------------------- build the spec ---------------------------- */

  const buildSpec = useCallback(() => {
    return {
      category,
      subject,
      chapters: selectedChapters,
      topics: [],
      board: null,
      exam: null,
      year: null,
      language: null,
      totalQuestions: totalNum,
      totalMarks: null,
      difficultyDistribution: distribute(difficultyPct, totalNum).map((e) => ({
        difficulty: e.key,
        count: e.count,
      })),
      typeDistribution: distribute(typePct, totalNum).map((e) => ({ type: e.key, count: e.count })),
      chapterDistribution:
        chapterMode === "custom"
          ? distribute(
              Object.fromEntries(selectedChapters.map((id) => [id, chapterPct[id] ?? ""])),
              totalNum,
            ).map((e) => ({ chapter: e.key, count: e.count }))
          : [],
      previousQuestions: {
        mode: prevMode,
        percent: prevMode === "exclude" ? 0 : Number(prevPct) || 0,
        paperRange: Number(prevRange) || 0,
      },
      excludeRecentPapers: Number(excludeRecent) || 0,
      mandatoryQuestionIds: mandatoryIds,
      excludedQuestionIds: excludedIds,
      randomize: { selection: rndSelection, order: rndOrder, options: rndOptions },
      status: "APPROVED" as const,
    };
  }, [
    category, subject, selectedChapters, totalNum, difficultyPct, typePct, chapterMode, chapterPct,
    prevMode, prevPct, prevRange, excludeRecent, mandatoryIds, excludedIds,
    rndSelection, rndOrder, rndOptions,
  ]);

  /* ----------------------------- live summary --------------------------- */

  useEffect(() => {
    if (!category || !subject || selectedChapters.length === 0 || totalNum <= 0) {
      queueMicrotask(() => setSummary(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setSummaryBusy(true));
    const timer = setTimeout(async () => {
      const r = await apiFetch<{ eligibleCount: number }>("/api/papers/generate", {
        method: "PUT",
        json: buildSpec(),
      });
      if (cancelled) return;
      setSummaryBusy(false);
      setSummary(r.success ? { eligibleCount: r.data.eligibleCount } : null);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildSpec, category, subject, selectedChapters.length, totalNum]);

  /* ------------------------------- generate ---------------------------- */

  const generate = useCallback(async () => {
    setBusy(true);
    setError("");
    setErrors({});
    setResult(null);

    const r = await apiFetch<{ paper: { _id: string }; result: GenResult }>("/api/papers/generate", {
      method: "POST",
      json: { title, instructions: "", durationMinutes: null, paperType, spec: buildSpec() },
    });

    setBusy(false);
    if (!r.success) {
      setErrors(fieldErrors(r));
      setError(r.error.message);
      toast.error(r.error.message);
      return;
    }
    setResult({ data: r.data.result, paperId: r.data.paper._id });
    toast.success("Question paper generated.");
  }, [title, paperType, buildSpec, toast]);

  const { showLeaveModal, confirmSaveAndLeave, confirmDiscardAndLeave, cancelLeave } = useUnsavedChanges({
    isDirty: isDirty && !result,
    onSave: async () => {
      if (!canGenerate) return false;
      await generate();
      return true;
    },
    onDiscard: () => {
      setTitle("");
      setCategory("");
      setSubject("");
      setSelectedChapters([]);
    },
  });

  /* --------------------------- small helpers -------------------------- */

  const diffCounts = useMemo(() => distribute(difficultyPct, totalNum), [difficultyPct, totalNum]);
  const typeCounts = useMemo(() => distribute(typePct, totalNum), [typePct, totalNum]);
  const diffCountOf = (k: string) => diffCounts.find((e) => e.key === k)?.count ?? 0;
  const typeCountOf = (k: string) => typeCounts.find((e) => e.key === k)?.count ?? 0;

  function toggleId(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  /* -------------------------------- render --------------------------- */

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Smart question generation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set a target and, optionally, how the questions should be spread. Filters are flexible —
          the closest available matches from your organization are used to hit the total.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* 1. Paper details */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Paper details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" required>
            {({ id }) => <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} required />}
          </Field>
          <Field label="Paper type">
            {({ id }) => (
              <Select id={id} value={paperType} onChange={(e) => setPaperType(e.target.value)}>
                {PAPER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Category" error={errors.category} required>
            {({ id }) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Subject" error={errors.subject} required>
            {({ id }) => (
              <Select id={id} value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Select…</option>
                {subjects.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {/* 2. Total */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Total questions</h2>
        <div className="mt-3 max-w-[10rem]">
          <TextInput
            type="number"
            min={1}
            max={500}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">Every percentage below is shown as its question count.</p>
      </Card>

      {/* 3. Chapters + distribution */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Chapters</h2>
          {selectedChapters.length > 0 ? (
            <div className="flex gap-1 text-xs">
              {(["auto", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setChapterMode(m)}
                  className={`rounded-md px-2 py-1 ${chapterMode === m ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  {m === "auto" ? "Automatic" : "Custom"}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {chapters.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Select a subject to list its chapters.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {chapters.map((c) => {
              const active = selectedChapters.includes(c._id);
              return (
                <button
                  key={c._id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleId(selectedChapters, setSelectedChapters, c._id)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        {errors.chapters ? <p className="mt-2 text-xs text-red-600">{errors.chapters}</p> : null}

        {chapterMode === "custom" && selectedChapters.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {selectedChapters.map((id) => {
              const chapter = chapters.find((c) => c._id === id);
              return (
                <Field key={id} label={chapter?.name ?? "Chapter"} hint={`${countFor(chapterPct[id] ?? "", totalNum)} question(s)`}>
                  {({ id: fid }) => (
                    <div className="flex items-center gap-2">
                      <TextInput
                        id={fid}
                        type="number"
                        min={0}
                        max={100}
                        value={chapterPct[id] ?? ""}
                        onChange={(e) => setChapterPct((p) => ({ ...p, [id]: e.target.value }))}
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  )}
                </Field>
              );
            })}
          </div>
        ) : null}
      </Card>

      {/* 4. Difficulty distribution */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Difficulty distribution</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DIFFICULTIES.map((d) => (
            <Field key={d} label={d} hint={`${difficultyPct[d] || "0"}% · ${diffCountOf(d)} question(s)`}>
              {({ id }) => (
                <div className="flex items-center gap-2">
                  <TextInput
                    id={id}
                    type="number"
                    min={0}
                    max={100}
                    value={difficultyPct[d] ?? ""}
                    onChange={(e) => setDifficultyPct((p) => ({ ...p, [d]: e.target.value }))}
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              )}
            </Field>
          ))}
        </div>
        {errors.difficultyDistribution ? (
          <p className="mt-2 text-xs text-red-600">{errors.difficultyDistribution}</p>
        ) : null}
      </Card>

      {/* 5. Type distribution */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Question type distribution</h2>
        <p className="mt-1 text-xs text-slate-500">Leave blank for any mix.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GEN_TYPES.map((t) => (
            <Field key={t} label={t.replace(/_/g, " ")} hint={`${typePct[t] || "0"}% · ${typeCountOf(t)} question(s)`}>
              {({ id }) => (
                <div className="flex items-center gap-2">
                  <TextInput
                    id={id}
                    type="number"
                    min={0}
                    max={100}
                    value={typePct[t] ?? ""}
                    onChange={(e) => setTypePct((p) => ({ ...p, [t]: e.target.value }))}
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              )}
            </Field>
          ))}
        </div>
        {errors.typeDistribution ? (
          <p className="mt-2 text-xs text-red-600">{errors.typeDistribution}</p>
        ) : null}
      </Card>

      {/* 7 & 8. Previous questions */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Previous questions</h2>

        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={prevPct}
            disabled={prevMode === "exclude"}
            onChange={(e) => setPrevPct(e.target.value)}
            className="w-full accent-brand-600 disabled:opacity-40"
          />
          <p className="mt-1 text-xs text-slate-500">
            {prevMode === "exclude"
              ? "No previously used questions will be included."
              : `Up to ${prevPct}% · ${countFor(prevPct, totalNum)} of ${totalNum} questions may be previously used.`}
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-700">Previous question mode</p>
            <div className="mt-2 flex flex-col gap-1.5 text-sm text-slate-700">
              {([
                ["exclude", "Don't use previous questions"],
                ["allow", "Allow previous questions"],
                ["prefer", "Prefer previous questions"],
              ] as const).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="prevMode"
                    checked={prevMode === value}
                    onChange={() => setPrevMode(value)}
                    className="accent-brand-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Previous paper range">
              {({ id }) => (
                <Select id={id} value={prevRange} onChange={(e) => setPrevRange(e.target.value)} disabled={prevMode === "exclude"}>
                  {PREV_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Exclude questions used in the last N papers" hint="0 = no recency limit">
              {({ id }) => (
                <TextInput id={id} type="number" min={0} max={50} value={excludeRecent} onChange={(e) => setExcludeRecent(e.target.value)} />
              )}
            </Field>
          </div>
        </div>
      </Card>

      {/* 10. Mandatory / excluded */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Mandatory &amp; excluded questions</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(["mandatory", "excluded"] as const).map((kind) => {
            const ids = kind === "mandatory" ? mandatoryIds : excludedIds;
            const setIds = kind === "mandatory" ? setMandatoryIds : setExcludedIds;
            const otherIds = kind === "mandatory" ? excludedIds : mandatoryIds;
            return (
              <div key={kind} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700 capitalize">{kind} questions</p>
                  <button
                    type="button"
                    disabled={!subject}
                    onClick={() => setPickerOpen(pickerOpen === kind ? null : kind)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {pickerOpen === kind ? "Done" : "Select questions"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{ids.length} selected</p>
                {pickerOpen === kind ? (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-100">
                    {pool.length === 0 ? (
                      <p className="p-2 text-xs text-slate-500">No approved questions in this subject.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {pool.map((q) => {
                          const disabled = otherIds.includes(q._id);
                          return (
                            <li key={q._id} className="flex items-start gap-2 p-2 text-xs">
                              <input
                                type="checkbox"
                                className="mt-0.5 accent-brand-600"
                                checked={ids.includes(q._id)}
                                disabled={disabled}
                                onChange={() => toggleId(ids, setIds, q._id)}
                              />
                              <span className={disabled ? "text-slate-300" : "text-slate-700"}>
                                {q.question.text.slice(0, 110)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {errors.mandatoryQuestionIds ? (
          <p className="mt-2 text-xs text-red-600">{errors.mandatoryQuestionIds}</p>
        ) : null}
        {errors.excludedQuestionIds ? (
          <p className="mt-2 text-xs text-red-600">{errors.excludedQuestionIds}</p>
        ) : null}
      </Card>

      {/* 11. Randomization */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Randomization</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
          {([
            [rndSelection, setRndSelection, "Randomize question selection"],
            [rndOrder, setRndOrder, "Randomize question order"],
            [rndOptions, setRndOptions, "Randomize MCQ options"],
          ] as const).map(([value, setValue, label], i) => (
            <label key={i} className="flex items-center gap-2">
              <input type="checkbox" className="accent-brand-600" checked={value} onChange={(e) => setValue(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </Card>

      {/* Summary + generate */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">{totalNum} questions</h2>
          {summaryBusy ? <Spinner label="Checking" /> : null}
        </div>
        <div className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <p className="font-medium text-slate-700">Difficulty</p>
            {DIFFICULTIES.filter((d) => diffCountOf(d) > 0).map((d) => (
              <p key={d}>{d} · {difficultyPct[d]}% · {diffCountOf(d)}</p>
            ))}
            {diffCounts.length === 0 ? <p>No preference</p> : null}
          </div>
          <div>
            <p className="font-medium text-slate-700">Previous questions</p>
            <p>
              {prevMode === "exclude"
                ? "Excluded"
                : `${prevMode === "prefer" ? "Prefer, " : ""}up to ${prevPct}% · ${countFor(prevPct, totalNum)}`}
            </p>
            <p className="font-medium text-slate-700 mt-2">Recent exclusion</p>
            <p>{Number(excludeRecent) > 0 ? `Last ${excludeRecent} paper(s)` : "None"}</p>
            <p className="font-medium text-slate-700 mt-2">Eligible questions</p>
            <p>{summary ? summary.eligibleCount : "—"}</p>
          </div>
        </div>

        <div className="mt-5">
          <Button
            loading={busy}
            disabled={!canGenerate}
            onClick={generate}
            className={canGenerate ? "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20" : "opacity-50 cursor-not-allowed bg-slate-200 text-slate-500"}
          >
            Generate question paper
          </Button>
        </div>
      </Card>

      {/* Result */}
      {result ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800">{result.data.selected} questions generated</h2>
          <div className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {DIFFICULTIES.filter((d) => (result.data.difficultyRequested[d] ?? 0) > 0 || (result.data.difficultyActual[d] ?? 0) > 0).map((d) => (
              <p key={d}>
                {d}: {result.data.difficultyActual[d] ?? 0}
                {result.data.difficultyRequested[d] ? ` / ${result.data.difficultyRequested[d]}` : ""}
              </p>
            ))}
            {result.data.previousAllowed > 0 && result.data.previousAllowed < result.data.requested ? (
              <p>Previous: {result.data.previousUsedCount} / {result.data.previousAllowed}</p>
            ) : (
              <p>Previous used: {result.data.previousUsedCount}</p>
            )}
          </div>

          {result.data.warnings.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {result.data.warnings.map((w, i) => (
                <li key={i} className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">{w.message}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Best available match was used.</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push(`/dashboard/papers/${result.paperId}`)}>View paper</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>Generate another</Button>
          </div>
        </Card>
      ) : null}

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onStay={cancelLeave}
        onDiscard={confirmDiscardAndLeave}
        onSave={() => void confirmSaveAndLeave()}
        canSave={canGenerate}
        saving={busy}
        title="Unsaved paper configuration"
        description="You have configured a paper that hasn't been generated yet. Generate it or discard before leaving?"
      />
    </div>
  );
}
