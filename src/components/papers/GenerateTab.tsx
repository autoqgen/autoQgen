"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  BookOpen,
  Boxes,
  ClipboardCheck,
  Gauge,
  GitBranch,
  History,
  ListChecks,
  Shapes,
  ShieldCheck,
  Shuffle,
  Tags,
} from "lucide-react";

import { Alert, Badge, Button, Field, Select, Spinner, TextInput } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { DIFFICULTIES, LANGUAGES, QUESTION_TYPES } from "@/types/question";

/**
 * Generate tab of the Paper View sidebar.
 *
 * Loads the exact generation configuration saved on the paper (never
 * reconstructed from the questions) and is fully editable. "Regenerate Paper"
 * runs a fresh selection through the existing Smart Generation engine and
 * creates a NEW paper — the current one is untouched. Category / subject /
 * organization are locked to the source paper server-side.
 */

const GEN_TYPES = QUESTION_TYPES.slice(0, 6) as readonly string[];
const PREV_RANGE_OPTIONS = [
  { value: "1", label: "Last 1 paper" },
  { value: "2", label: "Last 2 papers" },
  { value: "3", label: "Last 3 papers" },
  { value: "5", label: "Last 5 papers" },
  { value: "10", label: "Last 10 papers" },
  { value: "0", label: "All previous papers" },
];
const PREV_MODE = [
  ["exclude", "Don't use previous questions"],
  ["allow", "Allow previous questions"],
  ["prefer", "Prefer previous questions"],
] as const;

type DiffQuota = { difficulty: string; count: number };
type TypeQuota = { type: string; count: number };
type ChapterQuota = { chapter: string; count: number };
type TaxOpt = { _id: string; name: string; chapter?: string };

export interface GenerationView {
  paperId: string;
  paperTitle: string;
  description: string;
  instructions: string;
  durationMinutes: number | null;
  canRegenerate: boolean;
  organizationLabel: string;
  categoryLabel: string;
  subjectLabel: string;
  boardLabel: string | null;
  examLabel: string | null;
  chapters: { id: string; name: string }[];
  topics: { id: string; name: string }[];
  spec: {
    category: string;
    subject: string;
    board: string | null;
    exam: string | null;
    year: number | null;
    language: string | null;
    chapters: string[];
    topics: string[];
    totalQuestions: number;
    totalMarks: number | null;
    difficultyDistribution: DiffQuota[];
    typeDistribution: TypeQuota[];
    chapterDistribution: ChapterQuota[];
    previousQuestions: { mode: string; percent: number; paperRange: number };
    excludeRecentPapers: number;
    mandatoryQuestionIds: string[];
    excludedQuestionIds: string[];
    randomize: { selection: boolean; order: boolean; options: boolean };
  };
  history: {
    id: string;
    round: number;
    totalQuestions: number;
    status: string;
    createdAt: string;
    isCurrent: boolean;
  }[];
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
  warnings: { code: string; message: string }[];
}

const round = Math.round;
const pctOf = (count: number, total: number) => (total > 0 ? round((count / total) * 100) : 0);

/** Largest-remainder split of `total` across non-zero percentages, ordered by `keys`. */
function distribute(map: Record<string, string>, total: number): { key: string; count: number }[] {
  const entries = Object.entries(map)
    .map(([key, v]) => ({ key, p: Number(v) || 0 }))
    .filter((e) => e.p > 0);
  const sum = entries.reduce((s, e) => s + e.p, 0);
  if (sum <= 0 || total <= 0) return [];
  const raw = entries.map((e) => ({ key: e.key, exact: (e.p / sum) * total }));
  const out = raw.map((r) => ({ key: r.key, count: Math.floor(r.exact) }));
  let assigned = out.reduce((s, r) => s + r.count, 0);
  [...raw]
    .map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (assigned < total) {
        out[i]!.count += 1;
        assigned += 1;
      }
    });
  return out.filter((r) => r.count > 0);
}

function SectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
      {children}
    </p>
  );
}

function PercentRow({
  label,
  value,
  onChange,
  count,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  count: number;
}) {
  return (
    <Field label={label} hint={`${value || "0"}% · ${count} questions`}>
      {({ id }) => (
        <div className="flex items-center gap-1.5">
          <TextInput id={id} type="number" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="text-xs text-slate-500">%</span>
        </div>
      )}
    </Field>
  );
}

export default function GenerateTab({ view }: { view: GenerationView }) {
  const router = useRouter();
  const { spec } = view;

  // ---- editable state, seeded from the saved config ----
  const [board, setBoard] = useState(spec.board ?? "");
  const [exam, setExam] = useState(spec.exam ?? "");
  const [language, setLanguage] = useState(spec.language ?? "");
  const [total, setTotal] = useState(String(spec.totalQuestions));
  const [targetMarks, setTargetMarks] = useState(spec.totalMarks != null ? String(spec.totalMarks) : "");
  const totalNum = Math.max(0, Number(total) || 0);

  const [selectedChapters, setSelectedChapters] = useState<string[]>(spec.chapters);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(spec.topics);
  const [chapterMode, setChapterMode] = useState<"auto" | "custom">(spec.chapterDistribution.length ? "custom" : "auto");
  const [chapterPct, setChapterPct] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.chapterDistribution.map((c) => [c.chapter, String(pctOf(c.count, spec.totalQuestions))])),
  );
  const [topicMode, setTopicMode] = useState<"auto" | "custom">("auto");
  const [topicPct, setTopicPct] = useState<Record<string, string>>({});

  const [difficultyPct, setDifficultyPct] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.difficultyDistribution.map((d) => [d.difficulty, String(pctOf(d.count, spec.totalQuestions))])),
  );
  const [typePct, setTypePct] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.typeDistribution.map((t) => [t.type, String(pctOf(t.count, spec.totalQuestions))])),
  );

  const [prevMode, setPrevMode] = useState(spec.previousQuestions.mode);
  const [prevPct, setPrevPct] = useState(String(spec.previousQuestions.percent));
  const [prevRange, setPrevRange] = useState(String(spec.previousQuestions.paperRange));
  const [excludeRecent, setExcludeRecent] = useState(String(spec.excludeRecentPapers));

  const [mandatoryIds, setMandatoryIds] = useState<string[]>(spec.mandatoryQuestionIds);
  const [excludedIds, setExcludedIds] = useState<string[]>(spec.excludedQuestionIds);
  const [picker, setPicker] = useState<"mandatory" | "excluded" | null>(null);
  const [rnd, setRnd] = useState(spec.randomize);

  // ---- option data ----
  const [boards, setBoards] = useState<TaxOpt[]>([]);
  const [exams, setExams] = useState<TaxOpt[]>([]);
  const [chapterOpts, setChapterOpts] = useState<TaxOpt[]>(view.chapters.map((c) => ({ _id: c.id, name: c.name })));
  const [topicOpts, setTopicOpts] = useState<TaxOpt[]>([]);
  const [pool, setPool] = useState<{ _id: string; question: { text: string } }[]>([]);

  // ---- flow ----
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ data: GenResult; paperId: string } | null>(null);
  const [summary, setSummary] = useState<GenResult | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);

  useEffect(() => {
    void apiFetch<TaxOpt[]>("/api/boards?limit=100").then((r) => r.success && setBoards(r.data));
    void apiFetch<TaxOpt[]>("/api/exams?limit=100").then((r) => r.success && setExams(r.data));
    void apiFetch<TaxOpt[]>(`/api/chapters?limit=100&subject=${spec.subject}`).then(
      (r) => r.success && r.data.length > 0 && setChapterOpts(r.data),
    );
    void apiFetch<(TaxOpt & { chapter?: string })[]>(`/api/topics?limit=200&subject=${spec.subject}`).then(
      (r) => r.success && setTopicOpts(r.data),
    );
    void apiFetch<{ _id: string; question: { text: string } }[]>(
      `/api/questions?status=APPROVED&subject=${spec.subject}&limit=100`,
    ).then((r) => r.success && setPool(r.data));
  }, [spec.subject]);

  const chapterTopics = useMemo(
    () => topicOpts.filter((t) => t.chapter && selectedChapters.includes(t.chapter)),
    [topicOpts, selectedChapters],
  );

  const diffCounts = useMemo(() => distribute(difficultyPct, totalNum), [difficultyPct, totalNum]);
  const typeCounts = useMemo(() => distribute(typePct, totalNum), [typePct, totalNum]);
  const chapterCounts = useMemo(() => distribute(chapterPct, totalNum), [chapterPct, totalNum]);
  const topicCounts = useMemo(() => distribute(topicPct, totalNum), [topicPct, totalNum]);
  const cOf = (list: { key: string; count: number }[], k: string) => list.find((e) => e.key === k)?.count ?? 0;
  const sumOf = (list: { count: number }[]) => list.reduce((s, e) => s + e.count, 0);
  const pctSum = (m: Record<string, string>) => Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0);

  const buildSpec = useCallback(() => {
    return {
      category: spec.category,
      subject: spec.subject,
      chapters: selectedChapters,
      topics: topicMode === "custom" ? selectedTopics : selectedTopics,
      board: board || null,
      exam: exam || null,
      year: spec.year,
      language: language || null,
      totalQuestions: totalNum,
      totalMarks: targetMarks ? Number(targetMarks) : null,
      difficultyDistribution: diffCounts.map((e) => ({ difficulty: e.key, count: e.count })),
      typeDistribution: typeCounts.map((e) => ({ type: e.key, count: e.count })),
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
      randomize: rnd,
      status: "APPROVED" as const,
    };
  }, [
    spec.category, spec.subject, spec.year, selectedChapters, selectedTopics, topicMode, board, exam, language,
    totalNum, targetMarks, diffCounts, typeCounts, chapterMode, chapterPct, prevMode, prevPct, prevRange,
    excludeRecent, mandatoryIds, excludedIds, rnd,
  ]);

  // Debounced live eligibility summary (reuses the generate dry-run).
  useEffect(() => {
    if (selectedChapters.length === 0 || totalNum < 1) {
      queueMicrotask(() => setSummary(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setSummaryBusy(true));
    const t = setTimeout(async () => {
      const r = await apiFetch<GenResult>("/api/papers/generate", { method: "PUT", json: buildSpec() });
      if (cancelled) return;
      setSummaryBusy(false);
      setSummary(r.success ? r.data : null);
    }, 550);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [buildSpec, selectedChapters.length, totalNum]);

  async function regenerate() {
    setBusy(true);
    setError("");
    setErrors({});
    setResult(null);
    const r = await apiFetch<{ paper: { _id: string }; result: GenResult }>(
      `/api/papers/${view.paperId}/regenerate`,
      {
        method: "POST",
        json: {
          title: `${view.paperTitle} — regenerated`,
          description: view.description,
          instructions: view.instructions,
          durationMinutes: view.durationMinutes,
          spec: buildSpec(),
        },
      },
    );
    setBusy(false);
    if (!r.success) {
      setErrors(fieldErrors(r));
      setError(r.error.message);
      return;
    }
    setResult({ data: r.data.result, paperId: r.data.paper._id });
  }

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }
  const historyDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const mandatoryCount = mandatoryIds.length;
  const autoCount = Math.max(0, totalNum - mandatoryCount);

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* ---- Result after regeneration ---- */}
      {result ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-900">Regenerated successfully</p>
          <p className="mt-1 text-emerald-800">{result.data.selected} questions generated</p>
          <div className="mt-2 grid gap-0.5 text-xs text-emerald-900">
            {DIFFICULTIES.filter(
              (d) => (result!.data.difficultyRequested[d] ?? 0) > 0 || (result!.data.difficultyActual[d] ?? 0) > 0,
            ).map((d) => (
              <p key={d}>
                {d}: {result!.data.difficultyActual[d] ?? 0}
                {result!.data.difficultyRequested[d] ? ` / ${result!.data.difficultyRequested[d]}` : ""}
              </p>
            ))}
            <p>
              Previous: {result.data.previousUsedCount}
              {result.data.previousAllowed > 0 && result.data.previousAllowed < result.data.requested
                ? ` / ${result.data.previousAllowed}`
                : ""}
            </p>
            <p>Eligible questions: {result.data.eligibleCount}</p>
          </div>
          {result.data.warnings.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {result.data.warnings.map((w, i) => (
                <li key={i} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                  {w.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-emerald-700">Best available match was used.</p>
          )}
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/papers/${result.paperId}`)}>Open new paper</Button>
          </div>
        </div>
      ) : null}

      {/* ---- Basic scope ---- */}
      <div className="flex flex-col gap-3">
        <SectionLabel icon={Boxes}>Basic Scope</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-slate-400">Category</p>
            <p className="text-sm text-slate-800">{view.categoryLabel || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Subject</p>
            <p className="text-sm text-slate-800">{view.subjectLabel || "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">Chapters</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chapterOpts.map((c) => {
              const active = selectedChapters.includes(c._id);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggle(selectedChapters, setSelectedChapters, c._id)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    active ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Board">
            {({ id }) => (
              <Select id={id} value={board} onChange={(e) => setBoard(e.target.value)}>
                <option value="">None</option>
                {boards.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Exam">
            {({ id }) => (
              <Select id={id} value={exam} onChange={(e) => setExam(e.target.value)}>
                <option value="">None</option>
                {exams.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Language">
            {({ id }) => (
              <Select id={id} value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">Any</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l === "bn" ? "Bangla" : "English"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>

      {/* ---- Total & marks ---- */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total Questions">
          {({ id }) => (
            <TextInput id={id} type="number" min={1} max={500} value={total} onChange={(e) => setTotal(e.target.value)} />
          )}
        </Field>
        <Field label="Target Total Marks" hint="Optional">
          {({ id }) => (
            <TextInput id={id} type="number" min={0} value={targetMarks} onChange={(e) => setTargetMarks(e.target.value)} />
          )}
        </Field>
      </div>
      {errors.totalQuestions ? <p className="text-xs text-red-600">{errors.totalQuestions}</p> : null}

      {/* ---- Difficulty distribution ---- */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Gauge}>Difficulty Distribution</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {DIFFICULTIES.map((d) => (
            <PercentRow
              key={d}
              label={d}
              value={difficultyPct[d] ?? ""}
              onChange={(v) => setDifficultyPct((p) => ({ ...p, [d]: v }))}
              count={cOf(diffCounts, d)}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Total {pctSum(difficultyPct)}% · {sumOf(diffCounts)} questions
        </p>
        {errors.difficultyDistribution ? (
          <p className="text-xs text-red-600">{errors.difficultyDistribution}</p>
        ) : null}
      </div>

      {/* ---- Question type distribution ---- */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Shapes}>Question Type Distribution</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {GEN_TYPES.map((t) => (
            <PercentRow
              key={t}
              label={t.replace(/_/g, " ")}
              value={typePct[t] ?? ""}
              onChange={(v) => setTypePct((p) => ({ ...p, [t]: v }))}
              count={cOf(typeCounts, t)}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Total {pctSum(typePct)}% · {sumOf(typeCounts)} questions
        </p>
        {errors.typeDistribution ? <p className="text-xs text-red-600">{errors.typeDistribution}</p> : null}
      </div>

      {/* ---- Chapter distribution ---- */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={BookOpen}>Chapter Distribution</SectionLabel>
        <div className="flex gap-4 text-sm text-slate-700">
          {(["auto", "custom"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="chapterMode"
                className="accent-brand-600"
                checked={chapterMode === m}
                onChange={() => setChapterMode(m)}
              />
              {m === "auto" ? "Automatic" : "Custom"}
            </label>
          ))}
        </div>
        {chapterMode === "custom" ? (
          <div className="flex flex-col gap-3">
            {selectedChapters.map((id) => {
              const name = chapterOpts.find((c) => c._id === id)?.name ?? "Chapter";
              return (
                <div key={id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{name}</span>
                    <span className="text-slate-500">
                      {chapterPct[id] || "0"}% · {cOf(chapterCounts, id)} questions
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={chapterPct[id] ?? "0"}
                    onChange={(e) => setChapterPct((p) => ({ ...p, [id]: e.target.value }))}
                    className="mt-1 w-full accent-brand-600"
                  />
                </div>
              );
            })}
            <p className="text-xs text-slate-500">Insufficient chapters borrow from the closest eligible chapter.</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Questions spread across the selected chapters by availability.</p>
        )}
      </div>

      {/* ---- Topic distribution ---- */}
      {chapterTopics.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel icon={Tags}>Topic Distribution</SectionLabel>
          <div className="flex gap-4 text-sm text-slate-700">
            {(["auto", "custom"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="topicMode"
                  className="accent-brand-600"
                  checked={topicMode === m}
                  onChange={() => setTopicMode(m)}
                />
                {m === "auto" ? "Automatic" : "Custom"}
              </label>
            ))}
          </div>
          {topicMode === "custom" ? (
            <div className="flex flex-col gap-3">
              {chapterTopics.map((t) => {
                const on = selectedTopics.includes(t._id);
                return (
                  <div key={t._id}>
                    <label className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={on}
                          onChange={() => toggle(selectedTopics, setSelectedTopics, t._id)}
                        />
                        {t.name}
                      </span>
                      <span className="text-slate-500">
                        {topicPct[t._id] || "0"}% · {cOf(topicCounts, t._id)} questions
                      </span>
                    </label>
                    {on ? (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={topicPct[t._id] ?? "0"}
                        onChange={(e) => setTopicPct((p) => ({ ...p, [t._id]: e.target.value }))}
                        className="mt-1 w-full accent-brand-600"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Topics from the selected chapters, spread by availability.</p>
          )}
        </div>
      ) : null}

      {/* ---- Previous questions ---- */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={History}>Previous Questions</SectionLabel>
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
        <p className="text-xs text-slate-500">
          {prevMode === "exclude"
            ? "No previously used questions."
            : `${prevPct}% · ${round((Number(prevPct) / 100) * totalNum)} of ${totalNum} questions`}
        </p>
        <div className="mt-1 flex flex-col gap-1 text-sm text-slate-700">
          {PREV_MODE.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="prevMode"
                className="accent-brand-600"
                checked={prevMode === value}
                onChange={() => setPrevMode(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <Field label="Previous Paper Range">
          {({ id }) => (
            <Select id={id} value={prevRange} onChange={(e) => setPrevRange(e.target.value)} disabled={prevMode === "exclude"}>
              {PREV_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Exclude questions used in the last N papers" hint="0 = no limit">
          {({ id }) => (
            <TextInput
              id={id}
              type="number"
              min={0}
              max={50}
              value={excludeRecent}
              onChange={(e) => setExcludeRecent(e.target.value)}
            />
          )}
        </Field>
      </div>

      {/* ---- Eligibility ---- */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={ShieldCheck}>Question Eligibility</SectionLabel>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">Status</span>
          <Badge tone="green">Approved only</Badge>
        </div>
        <p className="text-xs text-slate-500">Generation always draws from approved questions only.</p>
      </div>

      {/* ---- Mandatory / excluded ---- */}
      <div className="flex flex-col gap-3">
        <SectionLabel icon={ListChecks}>Mandatory &amp; Excluded</SectionLabel>
        {(["mandatory", "excluded"] as const).map((kind) => {
          const ids = kind === "mandatory" ? mandatoryIds : excludedIds;
          const setIds = kind === "mandatory" ? setMandatoryIds : setExcludedIds;
          const other = kind === "mandatory" ? excludedIds : mandatoryIds;
          return (
            <div key={kind} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700 capitalize">{kind} Questions</p>
                <button
                  type="button"
                  onClick={() => setPicker(picker === kind ? null : kind)}
                  className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {picker === kind ? "Done" : "+ Select Questions"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">{ids.length} selected</p>
              {picker === kind ? (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-slate-100">
                  {pool.length === 0 ? (
                    <p className="p-2 text-xs text-slate-500">No approved questions in this subject.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {pool.map((q) => {
                        const disabled = other.includes(q._id);
                        return (
                          <li key={q._id} className="flex items-start gap-2 p-2 text-xs">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-brand-600"
                              checked={ids.includes(q._id)}
                              disabled={disabled}
                              onChange={() => toggle(ids, setIds, q._id)}
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
        <p className="text-xs text-slate-500">
          {totalNum} total · {mandatoryCount} mandatory · {autoCount} automatically selected
        </p>
        {errors.mandatoryQuestionIds ? <p className="text-xs text-red-600">{errors.mandatoryQuestionIds}</p> : null}
        {errors.excludedQuestionIds ? <p className="text-xs text-red-600">{errors.excludedQuestionIds}</p> : null}
      </div>

      {/* ---- Randomization ---- */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={Shuffle}>Randomization</SectionLabel>
        <div className="flex flex-col gap-1 text-sm text-slate-700">
          {(
            [
              ["selection", "Randomize selection"],
              ["order", "Randomize question order"],
              ["options", "Randomize MCQ options"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={rnd[k]}
                onChange={(e) => setRnd((p) => ({ ...p, [k]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* ---- Generation Summary ---- */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <SectionLabel icon={ClipboardCheck}>Generation Summary</SectionLabel>
          {summaryBusy ? <Spinner label="Checking" /> : null}
        </div>
        <div className="mt-2 grid gap-1 text-xs text-slate-600">
          <p className="text-sm font-semibold text-slate-800">
            {totalNum} Questions · {targetMarks || sumOf(diffCounts) ? targetMarks || "—" : "—"} Marks
          </p>
          {diffCounts.length > 0 ? (
            <p>Difficulty: {diffCounts.map((d) => `${d.key} ${pctOf(d.count, totalNum)}%`).join(", ")}</p>
          ) : null}
          {typeCounts.length > 0 ? (
            <p>Types: {typeCounts.map((t) => `${t.key.replace(/_/g, " ")} ${pctOf(t.count, totalNum)}%`).join(", ")}</p>
          ) : null}
          {chapterMode === "custom" && chapterCounts.length > 0 ? (
            <p>
              Chapters:{" "}
              {chapterCounts
                .map((c) => `${chapterOpts.find((o) => o._id === c.key)?.name ?? "Chapter"} ${pctOf(c.count, totalNum)}%`)
                .join(", ")}
            </p>
          ) : null}
          <p>
            Previous:{" "}
            {prevMode === "exclude"
              ? "excluded"
              : `${prevPct}% · ${round((Number(prevPct) / 100) * totalNum)} questions`}
          </p>
          <p>Exclude recent: {Number(excludeRecent) > 0 ? `Last ${excludeRecent} papers` : "None"}</p>
          <p className="mt-1 font-medium text-slate-700">Eligible Questions</p>
          <p>{summary ? summary.eligibleCount : "—"}</p>
        </div>
      </div>

      {/* ---- Regenerate ---- */}
      {view.canRegenerate ? (
        <div className="border-t border-slate-200 pt-4">
          <Button
            loading={busy}
            disabled={selectedChapters.length === 0 || totalNum < 1}
            onClick={regenerate}
            className="w-full"
          >
            Regenerate Paper
          </Button>
        </div>
      ) : null}

      {/* ---- Generation history ---- */}
      {view.history.length > 1 ? (
        <div className="border-t border-slate-200 pt-4">
          <SectionLabel icon={GitBranch}>Generation History</SectionLabel>
          <ul className="mt-2 flex flex-col gap-2">
            {view.history.map((hh) => (
              <li key={hh.id} className="text-sm">
                {hh.isCurrent ? (
                  <div className="rounded-md bg-slate-50 px-2 py-1.5">
                    <p className="font-medium text-slate-800">Version {hh.round} · Current</p>
                    <p className="text-xs text-slate-500">
                      {hh.totalQuestions} questions · {historyDate(hh.createdAt)}
                    </p>
                  </div>
                ) : (
                  <Link href={`/dashboard/papers/${hh.id}`} className="block rounded-md px-2 py-1.5 hover:bg-slate-50">
                    <p className="text-slate-700">Version {hh.round}</p>
                    <p className="text-xs text-slate-400">
                      {hh.totalQuestions} questions · {historyDate(hh.createdAt)}
                    </p>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
