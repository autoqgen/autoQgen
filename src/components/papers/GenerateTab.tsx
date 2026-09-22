"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Ban,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  Gauge,
  Hash,
  History,
  ListChecks,
  Lock,
  Pin,
  RotateCcw,
  Search,
  Shapes,
  ShieldCheck,
  Shuffle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Alert, Badge, Button, Field, Select, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { DIFFICULTIES, LANGUAGES, QUESTION_TYPES } from "@/types/question";
import {
  DEFAULT_GENERATION_SETTINGS,
  evenChapterSplit,
  normalizeGenerationSpec,
} from "@/lib/generation/spec-defaults";

/**
 * Paper View → General sidebar: question regeneration.
 *
 * "Simple by default, powerful when needed." A normal user can regenerate from
 * the six visible sections without ever opening the two collapsed Advanced
 * blocks. Every advanced / restrictive option is off by default — including
 * `excludeRecentPapers`, which defaults to 0 on load so a legacy value can't
 * silently shrink the pool.
 *
 * `buildSpec()` runs its output through `normalizeGenerationSpec()`, so the
 * dry-run availability check and the regenerate call receive an identical,
 * safely-defaulted spec. The Smart Match engine and all backend rules are
 * unchanged.
 */

const GEN_TYPES = QUESTION_TYPES.slice(0, 6) as readonly string[];

/** Question-type labels + the order shown in the simple dropdown. */
const TYPE_LABELS: Record<string, string> = {
  MCQ: "MCQ",
  TRUE_FALSE: "True / False",
  FILL_BLANK: "Fill in the Blank",
  SHORT: "Short Answer",
  WRITTEN: "Written",
  MULTIPLE_CORRECT: "Multiple Correct",
};
const TYPE_ORDER = ["MCQ", "TRUE_FALSE", "FILL_BLANK", "SHORT", "WRITTEN", "MULTIPLE_CORRECT"] as const;

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  EXPERT: "Expert",
};
/** Simple difficulty presets (Expert is reachable through Custom). */
const DIFFICULTY_SIMPLE = ["EASY", "MEDIUM", "HARD"] as const;

const EXCLUDE_RECENT_OPTIONS = ["0", "1", "2", "3", "5", "10"] as const;
const COUNT_PRESETS = ["5", "10", "15", "20", "25", "30", "50"] as const;
const CUSTOM_DIFFICULTY_SEED: Record<string, string> = { EASY: "40", MEDIUM: "40", HARD: "20", EXPERT: "" };

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
    previousQuestions: { mode: string; percent: number; paperRange: number | null };
    excludeRecentPapers: number | null;
    mandatoryQuestionIds: string[];
    excludedQuestionIds: string[];
    randomize: { selection: boolean; order: boolean; options: boolean };
  };
}

interface GenResult {
  requested: number;
  selected: number;
  totalMarks: number;
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

/** Which simple difficulty preset the saved distribution represents. */
function detectDifficulty(map: Record<string, string>): string {
  const live = DIFFICULTIES.filter((k) => (Number(map[k]) || 0) > 0);
  if (live.length === 0) return "balanced";
  if (live.length === 1 && (Number(map[live[0]!]) || 0) === 100 && (DIFFICULTY_SIMPLE as readonly string[]).includes(live[0]!)) {
    return live[0]!;
  }
  return "custom";
}
function detectType(map: Record<string, string>): string {
  const live = GEN_TYPES.filter((k) => (Number(map[k]) || 0) > 0);
  if (live.length === 0) return "any";
  if (live.length === 1 && (Number(map[live[0]!]) || 0) === 100) return live[0]!;
  return "custom";
}

const SHORTFALL_CODES = new Set(["BUCKET_SHORTFALL", "DIFFICULTY_SHORTFALL", "TYPE_SHORTFALL", "CHAPTER_SHORTFALL"]);

function friendlyWarnings(warnings: { code: string }[], requested: number, eligible: number): string[] {
  const out: string[] = [];
  if (warnings.some((w) => w.code === "POOL_TOO_SMALL")) {
    out.push(
      `Only ${eligible} matching question${eligible === 1 ? "" : "s"} are available, but ${requested} were requested — the closest available questions were used.`,
    );
  }
  if (warnings.some((w) => SHORTFALL_CODES.has(w.code))) {
    out.push("Some preferences could not be fully matched, so the closest available questions were used.");
  }
  if (warnings.some((w) => w.code === "MARKS_MISMATCH")) {
    out.push("The selected questions do not add up to the target marks.");
  }
  return out;
}

/** Parse the true post-filter eligible count out of the generator's shortfall error. */
function parseEligibleForGeneration(message: string): number | null {
  const m = message.match(/only\s+(\d+)\s+eligible/i);
  if (m) return Number(m[1]);
  if (/no approved questions/i.test(message)) return 0;
  return null;
}

/* ------------------------------ UI atoms ------------------------------ */

/**
 * Shared open/closed state for the Section accordions, so the "Expand all /
 * Collapse all" toolbar can drive every section at once. Each Section still
 * expands/collapses individually via `toggle`; `defaultOpen` is preserved by the
 * parent, which seeds the same defaults into this map.
 */
type SectionBusValue = {
  open: Record<string, boolean>;
  toggle: (id: string) => void;
};
const SectionBus = createContext<SectionBusValue | null>(null);

/**
 * Every Section in this sidebar, in display order, with its initial open state.
 * Must stay in sync with the `<Section>` elements (and their `defaultOpen`) in
 * the render below — it seeds the shared open map and powers Expand/Collapse all.
 */
const SECTION_INITIAL_OPEN: Record<string, boolean> = {
  "Basic Scope": true,
  "Question Count": true,
  Difficulty: true,
  "Question Type": true,
  Coverage: true,
  "Previous Questions": true,
  "Advanced Previous Question Settings": false,
  "Advanced Filters": false,
  "Generation Summary": true,
};
const SECTION_TITLES = Object.keys(SECTION_INITIAL_OPEN);

function Section({
  icon: Icon,
  title,
  value,
  defaultOpen = true,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const bus = useContext(SectionBus);
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = bus ? bus.open[title] ?? defaultOpen : localOpen;
  const toggle = bus ? () => bus.toggle(title) : () => setLocalOpen((o) => !o);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
      >
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</span>
        {!open && value ? (
          <span className="max-w-[46%] truncate text-right text-xs text-slate-500">{value}</span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="flex flex-col gap-3 border-t border-slate-100 px-3 pt-3 pb-3.5">{children}</div> : null}
    </section>
  );
}


function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
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
    <Field label={label} hint={`${value || "0"}% · ${count} question${count === 1 ? "" : "s"}`}>
      {({ id }) => (
        <div className="flex items-center gap-1.5">
          <TextInput id={id} type="number" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="text-xs text-slate-500">%</span>
        </div>
      )}
    </Field>
  );
}

function ChapterPicker({
  options,
  selected,
  counts,
  onToggle,
}: {
  options: TaxOpt[];
  selected: string[];
  counts: Record<string, number>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const label =
    selected.length === 0
      ? "No chapters selected"
      : selected.length === 1
        ? options.find((o) => o._id === selected[0])?.name ?? "1 chapter selected"
        : `${selected.length} chapters selected`;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">
        Chapters <span className="text-red-600" aria-hidden>*</span>
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
          selected.length === 0 ? "border-amber-300 text-amber-700" : "border-slate-300 text-slate-800"
        }`}
      >
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-2 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chapters"
              aria-label="Search chapters"
              className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {shown.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-slate-500">No chapters match that search.</li>
            ) : (
              shown.map((c) => {
                const n = counts[c._id];
                return (
                  <li key={c._id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="accent-brand-600"
                        checked={selected.includes(c._id)}
                        onChange={() => onToggle(c._id)}
                      />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 text-slate-400">
                        {n === undefined ? "—" : `${n} available`}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
      <p className="mt-1 text-[11px] text-slate-400">
        Availability is informational — advanced filters below may change the final eligible pool.
      </p>
    </div>
  );
}

/* ------------------------------ Component ------------------------------ */

export default function GenerateTab({ view }: { view: GenerationView }) {
  const router = useRouter();
  const toast = useToast();
  const { spec } = view;

  // ---- Basic scope (Category/Subject locked by regeneration) ----
  const [language, setLanguage] = useState(spec.language ?? "");
  const [total, setTotal] = useState(String(spec.totalQuestions));
  const [countCustom, setCountCustom] = useState(
    () => !(COUNT_PRESETS as readonly string[]).includes(String(spec.totalQuestions)),
  );
  const totalNum = Math.max(0, Number(total) || 0);

  const [selectedChapters, setSelectedChapters] = useState<string[]>(spec.chapters);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(spec.topics);

  // ---- Difficulty ----
  const [difficultyPct, setDifficultyPct] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.difficultyDistribution.map((d) => [d.difficulty, String(pctOf(d.count, spec.totalQuestions))])),
  );
  const [diffChoice, setDiffChoice] = useState(() =>
    detectDifficulty(
      Object.fromEntries(spec.difficultyDistribution.map((d) => [d.difficulty, String(pctOf(d.count, spec.totalQuestions))])),
    ),
  );

  // ---- Question type ----
  const [typePct, setTypePct] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.typeDistribution.map((t) => [t.type, String(pctOf(t.count, spec.totalQuestions))])),
  );
  const [typeChoice, setTypeChoice] = useState(() =>
    detectType(Object.fromEntries(spec.typeDistribution.map((t) => [t.type, String(pctOf(t.count, spec.totalQuestions))]))),
  );

  // ---- Coverage ----
  const [coverage, setCoverage] = useState<"automatic" | "equal" | "custom">(
    spec.chapterDistribution.length ? "custom" : "automatic",
  );
  const [chapterPct, setChapterPct] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.chapterDistribution.map((c) => [c.chapter, String(pctOf(c.count, spec.totalQuestions))])),
  );
  const [topicMode, setTopicMode] = useState<"automatic" | "custom">("automatic");
  const [topicPct, setTopicPct] = useState<Record<string, string>>({});

  // ---- Previous questions (simple: Auto / Allow / Avoid) ----
  const [prevChoice, setPrevChoice] = useState<"auto" | "allow" | "avoid">(
    spec.previousQuestions.mode === "exclude" ? "avoid" : "auto",
  );

  // ---- Advanced previous-question settings ----
  // Reset to the SAFE default on load; the saved value (if any) is surfaced as a note.
  const savedExcludeRecent = spec.excludeRecentPapers ?? 0;
  const [excludeRecent, setExcludeRecent] = useState(
    spec.excludeRecentPapers == null ? String(DEFAULT_GENERATION_SETTINGS.excludeRecentPapers) : String(spec.excludeRecentPapers),
  );

  // ---- Advanced filters ----
  const [board, setBoard] = useState(spec.board ?? "");
  const [exam, setExam] = useState(spec.exam ?? "");
  const [year, setYear] = useState(spec.year != null ? String(spec.year) : "");
  const [mandatoryIds, setMandatoryIds] = useState<string[]>(spec.mandatoryQuestionIds);
  const [excludedIds, setExcludedIds] = useState<string[]>(spec.excludedQuestionIds);
  const [picker, setPicker] = useState<"mandatory" | "excluded" | null>(null);
  const [rnd, setRnd] = useState(spec.randomize);
  const [targetMarks, setTargetMarks] = useState(spec.totalMarks != null ? String(spec.totalMarks) : "");

  // ---- option data ----
  const [boards, setBoards] = useState<TaxOpt[]>([]);
  const [exams, setExams] = useState<TaxOpt[]>([]);
  const [chapterOpts, setChapterOpts] = useState<TaxOpt[]>(view.chapters.map((c) => ({ _id: c.id, name: c.name })));
  const [topicOpts, setTopicOpts] = useState<TaxOpt[]>([]);
  const [pool, setPool] = useState<{ _id: string; question: { text: string } }[]>([]);
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});

  // ---- flow ----
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ data: GenResult } | null>(null);
  const [summary, setSummary] = useState<GenResult | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryBusy, setSummaryBusy] = useState(false);

  /* ---- Expand all / Collapse all (same control as the Paper Design sidebar) ---- */
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() => ({ ...SECTION_INITIAL_OPEN }));
  const toggleSection = useCallback((id: string) => setSectionOpen((m) => ({ ...m, [id]: !m[id] })), []);
  const sectionBus = useMemo<SectionBusValue>(
    () => ({ open: sectionOpen, toggle: toggleSection }),
    [sectionOpen, toggleSection],
  );
  const allSectionsOpen = SECTION_TITLES.every((t) => sectionOpen[t]);
  const noSectionsOpen = SECTION_TITLES.every((t) => !sectionOpen[t]);
  const expandAll = () => setSectionOpen(Object.fromEntries(SECTION_TITLES.map((t) => [t, true])));
  const collapseAll = () => setSectionOpen(Object.fromEntries(SECTION_TITLES.map((t) => [t, false])));

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
    void apiFetch<{ total: number; chapters: Record<string, number> }>(
      `/api/questions/availability?category=${spec.category}&subject=${spec.subject}`,
    ).then((r) => r.success && setChapterCounts(r.data.chapters));
  }, [spec.subject, spec.category]);

  const chapterTopics = useMemo(
    () => topicOpts.filter((t) => t.chapter && selectedChapters.includes(t.chapter)),
    [topicOpts, selectedChapters],
  );

  const diffCounts = useMemo(() => distribute(difficultyPct, totalNum), [difficultyPct, totalNum]);
  const typeCounts = useMemo(() => distribute(typePct, totalNum), [typePct, totalNum]);
  const chapterCountsRes = useMemo(() => distribute(chapterPct, totalNum), [chapterPct, totalNum]);
  const topicCountsRes = useMemo(() => distribute(topicPct, totalNum), [topicPct, totalNum]);
  const cOf = (list: { key: string; count: number }[], k: string) => list.find((e) => e.key === k)?.count ?? 0;
  const pctSum = (m: Record<string, string>) => Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0);

  const excludeRecentNum = Number(excludeRecent) || 0;

  // ---- one normalized spec, used by dry-run AND regenerate ----
  const buildSpec = useCallback(() => {
    return normalizeGenerationSpec({
      organizationId: null,
      category: spec.category,
      subject: spec.subject,
      chapters: selectedChapters,
      topics: selectedTopics,
      board: board || null,
      exam: exam || null,
      year: year ? Number(year) : null,
      language: language || null,
      totalQuestions: totalNum,
      totalMarks: targetMarks ? Number(targetMarks) : null,
      difficultyDistribution: diffCounts.map((e) => ({ difficulty: e.key, count: e.count })),
      typeDistribution: typeCounts.map((e) => ({ type: e.key, count: e.count })),
      chapterDistribution:
        coverage === "custom"
          ? distribute(
              Object.fromEntries(selectedChapters.map((id) => [id, chapterPct[id] ?? ""])),
              totalNum,
            ).map((e) => ({ chapter: e.key, count: e.count }))
          : coverage === "equal"
            ? evenChapterSplit(selectedChapters, totalNum)
            : [],
      previousQuestions: {
        mode: prevChoice === "avoid" ? "exclude" : "allow",
        percent: prevChoice === "avoid" ? 0 : 100,
        paperRange: DEFAULT_GENERATION_SETTINGS.previousQuestions.paperRange,
      },
      excludeRecentPapers: excludeRecentNum,
      mandatoryQuestionIds: mandatoryIds,
      excludedQuestionIds: excludedIds,
      randomize: rnd,
      status: "APPROVED",
    });
  }, [
    spec.category, spec.subject, selectedChapters, selectedTopics, board, exam, year, language,
    totalNum, targetMarks, diffCounts, typeCounts, coverage, chapterPct, prevChoice, excludeRecentNum,
    mandatoryIds, excludedIds, rnd,
  ]);

  // Debounced live availability — same normalized spec the regenerate call uses.
  useEffect(() => {
    if (selectedChapters.length === 0 || totalNum < 1) {
      queueMicrotask(() => {
        setSummary(null);
        setSummaryError("");
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setSummaryBusy(true));
    const t = setTimeout(async () => {
      const r = await apiFetch<GenResult>("/api/papers/generate", { method: "PUT", json: buildSpec() });
      if (cancelled) return;
      setSummaryBusy(false);
      setSummary(r.success ? r.data : null);
      setSummaryError(r.success ? "" : r.error.message);
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
          title: view.paperTitle,
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
      setError(shortfallMessage(r.error.message));
      toast.error("Could not regenerate the paper", { description: shortfallMessage(r.error.message) });
      return;
    }
    setResult({ data: r.data.result });
    toast.success("Paper regenerated", {
      description: `${r.data.result.selected} questions selected using the best available matches.`,
      duration: 6000,
    });
    // The current paper was updated in place — refresh the page to show it.
    router.refresh();
  }

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const mandatoryCount = mandatoryIds.length;
  const autoCount = Math.max(0, totalNum - mandatoryCount);

  /* ---- simple-picker handlers ---- */
  function chooseDifficulty(value: string) {
    setDiffChoice(value);
    if (value === "balanced") setDifficultyPct({});
    else if (value === "custom") setDifficultyPct((p) => (pctSum(p) > 0 ? p : { ...CUSTOM_DIFFICULTY_SEED }));
    else setDifficultyPct({ [value]: "100" });
  }
  function chooseType(value: string) {
    setTypeChoice(value);
    if (value === "any") setTypePct({});
    else if (value !== "custom") setTypePct({ [value]: "100" });
  }

  /* ---- reset advanced settings to safe defaults (§17) ---- */
  /** Restores the safe defaults for the advanced/restrictive filters only (§17). */
  function resetAdvanced() {
    setExcludeRecent(String(DEFAULT_GENERATION_SETTINGS.excludeRecentPapers));
    setMandatoryIds([...DEFAULT_GENERATION_SETTINGS.mandatoryQuestionIds]);
    setExcludedIds([...DEFAULT_GENERATION_SETTINGS.excludedQuestionIds]);
    setSelectedTopics([...DEFAULT_GENERATION_SETTINGS.topics]);
    setTopicMode("automatic");
    setTopicPct({});
    setBoard(DEFAULT_GENERATION_SETTINGS.board ?? "");
    setExam(DEFAULT_GENERATION_SETTINGS.exam ?? "");
    setYear(DEFAULT_GENERATION_SETTINGS.year != null ? String(DEFAULT_GENERATION_SETTINGS.year) : "");
    setPicker(null);
    toast.success("Advanced settings reset to defaults");
  }

  /* ---- derived display ---- */
  const difficultySummary =
    diffChoice === "balanced"
      ? "Balanced"
      : diffChoice === "custom"
        ? diffCounts.map((d) => `${DIFFICULTY_LABELS[d.key] ?? d.key} ${d.count}`).join(" · ") || "Custom"
        : DIFFICULTY_LABELS[diffChoice] ?? diffChoice;

  const typeSummary =
    typeChoice === "any"
      ? "Any type"
      : typeChoice === "custom"
        ? typeCounts.map((t) => `${TYPE_LABELS[t.key] ?? t.key} ${t.count}`).join(" · ") || "Custom mix"
        : TYPE_LABELS[typeChoice] ?? typeChoice;

  const coverageSummary =
    coverage === "custom" ? "Custom" : coverage === "equal" ? "Equal" : "Automatic";

  const previousSummary =
    prevChoice === "avoid" ? "Avoid previous" : prevChoice === "allow" ? "Allow previous" : "Auto";

  const scopeSummary = [view.categoryLabel, view.subjectLabel, `${selectedChapters.length} chapters`]
    .filter(Boolean)
    .join(" · ");

  const diffTotal = pctSum(difficultyPct);
  const typeTotal = pctSum(typePct);
  const chapterTotal = pctSum(Object.fromEntries(selectedChapters.map((id) => [id, chapterPct[id] ?? ""])));

  const selectedChapterCountSum = selectedChapters.reduce((s, id) => s + (chapterCounts[id] ?? 0), 0);
  const approvedInScope = selectedChapters.length > 0 ? selectedChapterCountSum : null;

  const dryRunOk = Boolean(summary) && !summaryError;
  const eligibleForGeneration = summaryError
    ? parseEligibleForGeneration(summaryError)
    : dryRunOk
      ? Math.min(summary!.selected, totalNum)
      : null;

  const advisories = summary ? friendlyWarnings(summary.warnings, totalNum, summary.eligibleCount) : [];

  // Which active restriction most likely caused a shortfall (§11, §13).
  function shortfallCause(): string {
    if (excludeRecentNum > 0) {
      return `Your “Exclude recent papers” setting (${excludeRecentNum}) removed questions used in recent papers. Lower it in Advanced Previous Question Settings, or request fewer questions.`;
    }
    if (prevChoice === "avoid") {
      return "“Avoid previous questions” is excluding questions used on earlier papers. Switch it to Auto, or request fewer questions.";
    }
    const filters: string[] = [];
    if (selectedTopics.length) filters.push("topics");
    if (board) filters.push("board");
    if (exam) filters.push("exam");
    if (year) filters.push("year");
    if (excludedIds.length) filters.push("excluded questions");
    if (filters.length) {
      return `Your advanced filters (${filters.join(", ")}) are limiting the pool. Relax them, or request fewer questions.`;
    }
    return "Add another chapter, or request fewer questions.";
  }
  function shortfallMessage(raw: string): string {
    const n = parseEligibleForGeneration(raw);
    if (n === null) return raw;
    return `${totalNum} questions requested, but only ${n} are eligible with the current settings. ${shortfallCause()}`;
  }

  // Active-restriction summary before Regenerate (§16).
  const activeRestrictions: string[] = [];
  if (diffChoice !== "balanced") activeRestrictions.push(`Difficulty: ${difficultySummary}`);
  if (typeChoice !== "any") activeRestrictions.push(`Type: ${typeSummary}`);
  if (coverage !== "automatic") activeRestrictions.push(`Coverage: ${coverageSummary.toLowerCase()}`);
  if (prevChoice === "avoid") activeRestrictions.push("Avoid previous questions");
  if (excludeRecentNum > 0) activeRestrictions.push(`Exclude recent papers: ${excludeRecentNum}`);
  if (selectedTopics.length) activeRestrictions.push(`Topics: ${selectedTopics.length}`);
  if (board) activeRestrictions.push(`Board: ${boards.find((b) => b._id === board)?.name ?? "set"}`);
  if (exam) activeRestrictions.push(`Exam: ${exams.find((e) => e._id === exam)?.name ?? "set"}`);
  if (year) activeRestrictions.push(`Year: ${year}`);
  if (mandatoryIds.length) activeRestrictions.push(`${mandatoryIds.length} mandatory`);
  if (excludedIds.length) activeRestrictions.push(`${excludedIds.length} excluded`);

  const advFiltersActive =
    (selectedTopics.length ? 1 : 0) +
    (board ? 1 : 0) +
    (exam ? 1 : 0) +
    (year ? 1 : 0) +
    (mandatoryIds.length ? 1 : 0) +
    (excludedIds.length ? 1 : 0);

  const canRun = selectedChapters.length > 0 && totalNum >= 1;

  return (
    <SectionBus.Provider value={sectionBus}>
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* ---- Result after regeneration ---- */}
      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
            <Check className="h-4 w-4" />
            Paper regenerated successfully
          </p>
          <p className="mt-1 text-emerald-800">
            {result.data.selected} questions selected using the best available matches.
          </p>
          {friendlyWarnings(result.data.warnings, result.data.requested, result.data.eligibleCount).length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {friendlyWarnings(result.data.warnings, result.data.requested, result.data.eligibleCount).map((m, i) => (
                <li key={i} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                  {m}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 text-xs text-emerald-700">This paper has been updated in place.</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---- Expand all / Collapse all ---- */}
      <div className="flex items-center justify-end gap-3 border-b border-slate-100 pb-2">
        <button
          type="button"
          onClick={expandAll}
          disabled={allSectionsOpen}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={collapseAll}
          disabled={noSectionsOpen}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
        </button>
      </div>

      {/* ---- 1. Basic Scope ---- */}
      <Section icon={Boxes} title="Basic Scope" value={scopeSummary}>
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyRow label="Category *" value={view.categoryLabel} />
          <ReadOnlyRow label="Subject *" value={view.subjectLabel} />
        </div>

        <ChapterPicker
          options={chapterOpts}
          selected={selectedChapters}
          counts={chapterCounts}
          onToggle={(id) => toggle(selectedChapters, setSelectedChapters, id)}
        />
        {selectedChapters.length === 0 ? (
          <p className="text-xs text-red-600">Select at least one chapter.</p>
        ) : null}

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
      </Section>

      {/* ---- 2. Question Count ---- */}
      <Section icon={Hash} title="Question Count" value={`${totalNum}`}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Number of questions">
          {COUNT_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={!countCustom && total === n}
              onClick={() => {
                setCountCustom(false);
                setTotal(n);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                !countCustom && total === n
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={countCustom}
            onClick={() => setCountCustom(true)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              countCustom
                ? "bg-brand-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Custom
          </button>
        </div>
        {countCustom ? (
          <div className="max-w-[9rem]">
            <TextInput
              type="number"
              min={1}
              max={500}
              aria-label="Custom number of questions"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
        ) : null}
        {totalNum < 1 ? <p className="text-xs text-red-600">Choose a question count.</p> : null}
        {errors.totalQuestions ? <p className="text-xs text-red-600">{errors.totalQuestions}</p> : null}
      </Section>

      {/* ---- 3. Difficulty ---- */}
      <Section icon={Gauge} title="Difficulty" value={difficultySummary}>
        <Field label="Difficulty">
          {({ id }) => (
            <Select id={id} value={diffChoice} onChange={(e) => chooseDifficulty(e.target.value)}>
              <option value="balanced">Balanced</option>
              {DIFFICULTY_SIMPLE.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
              <option value="custom">Custom</option>
            </Select>
          )}
        </Field>

        {diffChoice === "custom" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map((d) => (
                <PercentRow
                  key={d}
                  label={DIFFICULTY_LABELS[d] ?? d}
                  value={difficultyPct[d] ?? ""}
                  onChange={(v) => setDifficultyPct((p) => ({ ...p, [d]: v }))}
                  count={cOf(diffCounts, d)}
                />
              ))}
            </div>
            {diffTotal > 0 && diffTotal !== 100 ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your difficulty percentages add up to {diffTotal}%. Adjust them to total 100%.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-slate-500">
            {diffChoice === "balanced"
              ? "A reasonable mix is chosen from the available questions."
              : `Prioritizes ${(DIFFICULTY_LABELS[diffChoice] ?? diffChoice).toLowerCase()} questions; the generator falls back to the closest available when a bucket is short.`}
          </p>
        )}
        {errors.difficultyDistribution ? <p className="text-xs text-red-600">{errors.difficultyDistribution}</p> : null}
      </Section>

      {/* ---- 4. Question Type ---- */}
      <Section icon={Shapes} title="Question Type" value={typeSummary}>
        <Field label="Question type">
          {({ id }) => (
            <Select id={id} value={typeChoice} onChange={(e) => chooseType(e.target.value)}>
              <option value="any">Any type</option>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t] ?? t.replace(/_/g, " ")}
                </option>
              ))}
              <option value="custom">Custom Mix</option>
            </Select>
          )}
        </Field>

        {typeChoice === "custom" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_ORDER.map((t) => (
                <PercentRow
                  key={t}
                  label={TYPE_LABELS[t] ?? t.replace(/_/g, " ")}
                  value={typePct[t] ?? ""}
                  onChange={(v) => setTypePct((p) => ({ ...p, [t]: v }))}
                  count={cOf(typeCounts, t)}
                />
              ))}
            </div>
            {typeTotal > 0 && typeTotal !== 100 ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your question-type percentages add up to {typeTotal}%. Adjust them to total 100%.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-slate-500">
            {typeChoice === "any"
              ? "No question-type restriction — any approved type may be used."
              : `Only ${TYPE_LABELS[typeChoice] ?? typeChoice} questions are selected.`}
          </p>
        )}
        {errors.typeDistribution ? <p className="text-xs text-red-600">{errors.typeDistribution}</p> : null}
      </Section>

      {/* ---- 5. Coverage ---- */}
      <Section icon={BookOpen} title="Coverage" value={coverageSummary}>
        <Field
          label="Chapter Distribution"
          hint={
            coverage === "automatic"
              ? "Questions are spread across the selected chapters by availability."
              : coverage === "equal"
                ? "Each selected chapter gets an equal share of the questions."
                : "Set an exact share per chapter below."
          }
        >
          {({ id }) => (
            <Select
              id={id}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value as "automatic" | "equal" | "custom")}
            >
              <option value="automatic">Automatic</option>
              <option value="equal">Equal Distribution</option>
              <option value="custom">Custom Distribution</option>
            </Select>
          )}
        </Field>

        {coverage === "custom" ? (
          <div className="flex flex-col gap-3">
            {selectedChapters.length === 0 ? (
              <p className="text-xs text-slate-500">Select at least one chapter first.</p>
            ) : null}
            {selectedChapters.map((id) => {
              const name = chapterOpts.find((c) => c._id === id)?.name ?? "Chapter";
              return (
                <div key={id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{name}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {chapterPct[id] || "0"}% · {cOf(chapterCountsRes, id)} questions
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    aria-label={`${name} share`}
                    value={chapterPct[id] ?? "0"}
                    onChange={(e) => setChapterPct((p) => ({ ...p, [id]: e.target.value }))}
                    className="mt-1 w-full accent-brand-600"
                  />
                </div>
              );
            })}
            {chapterTotal > 0 && chapterTotal !== 100 ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Chapter coverage totals {chapterTotal}%. The shares are scaled to fit {totalNum} questions.
              </p>
            ) : null}
          </div>
        ) : null}

        {chapterTopics.length > 0 ? (
          <>
            <Field
              label="Topic Distribution"
              hint={topicMode === "automatic" ? "Topics from the selected chapters, spread by availability." : undefined}
            >
              {({ id }) => (
                <Select
                  id={id}
                  value={topicMode}
                  onChange={(e) => setTopicMode(e.target.value as "automatic" | "custom")}
                >
                  <option value="automatic">Automatic</option>
                  <option value="custom">Custom</option>
                </Select>
              )}
            </Field>

            {topicMode === "custom" ? (
              <div className="flex flex-col gap-3">
                {chapterTopics.map((t) => {
                  const on = selectedTopics.includes(t._id);
                  return (
                    <div key={t._id}>
                      <label className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                          <input
                            type="checkbox"
                            className="shrink-0 accent-brand-600"
                            checked={on}
                            onChange={() => toggle(selectedTopics, setSelectedTopics, t._id)}
                          />
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {topicPct[t._id] || "0"}% · {cOf(topicCountsRes, t._id)} questions
                        </span>
                      </label>
                      {on ? (
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          aria-label={`${t.name} share`}
                          value={topicPct[t._id] ?? "0"}
                          onChange={(e) => setTopicPct((p) => ({ ...p, [t._id]: e.target.value }))}
                          className="mt-1 w-full accent-brand-600"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </Section>

      {/* ---- 6. Previous Questions ---- */}
      <Section icon={History} title="Previous Questions" value={previousSummary}>
        <Field label="Previous questions">
          {({ id }) => (
            <Select id={id} value={prevChoice} onChange={(e) => setPrevChoice(e.target.value as typeof prevChoice)}>
              <option value="auto">Auto</option>
              <option value="allow">Allow Previous Questions</option>
              <option value="avoid">Avoid Previous Questions</option>
            </Select>
          )}
        </Field>
        <p className="text-xs text-slate-500">
          {prevChoice === "avoid"
            ? "Questions used on earlier papers will be excluded. This can reduce the available pool."
            : "Previous questions are allowed. The generator uses the best available matches."}
        </p>
      </Section>

      {/* ---- 7. Advanced Previous Question Settings (collapsed) ---- */}
      <Section
        icon={ListChecks}
        title="Advanced Previous Question Settings"
        defaultOpen={false}
        value={excludeRecentNum > 0 ? "Modified" : undefined}
      >
        {savedExcludeRecent > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
            This paper was previously set to exclude the last {savedExcludeRecent} paper
            {savedExcludeRecent === 1 ? "" : "s"}. That restriction was cleared for a fresh regeneration — re-apply it
            below if you still want it.
          </div>
        ) : null}

        <Field label="Exclude Recent Papers">
          {({ id }) => (
            <Select id={id} value={excludeRecent} onChange={(e) => setExcludeRecent(e.target.value)}>
              {EXCLUDE_RECENT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === "0" ? "0 papers" : `${n} paper${n === "1" ? "" : "s"}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-xs text-slate-500">
          Avoid questions used in the selected number of recent papers. This may reduce the number of available
          questions.
        </p>
      </Section>

      {/* ---- 8. Advanced Filters (collapsed) ---- */}
      <Section
        icon={ShieldCheck}
        title="Advanced Filters"
        defaultOpen={false}
        value={
          advFiltersActive > 0
            ? `${mandatoryCount} mandatory · ${excludedIds.length} excluded · ${selectedTopics.length ? `${selectedTopics.length} topics` : "no topic filter"}`
            : "0 mandatory · 0 excluded · no topic filter · any board · any exam"
        }
      >
        {/* Eligibility (locked) */}
        <div className="rounded-lg border border-slate-200 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            Question Eligibility
          </p>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-slate-600">Status</span>
            <Badge tone="green">
              <Lock className="mr-1 inline h-3 w-3" />
              Approved only
            </Badge>
          </div>
        </div>

        {/* Topics */}
        <Field label="Topics" hint={chapterTopics.length === 0 ? "No topics in the selected chapters." : "All topics unless you pick specific ones."}>
          {() =>
            chapterTopics.length === 0 ? (
              <p className="text-xs text-slate-400">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {chapterTopics.map((t) => {
                  const on = selectedTopics.includes(t._id);
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => toggle(selectedTopics, setSelectedTopics, t._id)}
                      className={`rounded-md px-2 py-1 text-xs ${
                        on ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )
          }
        </Field>

        {/* Board / Exam / Year */}
        <div className="grid grid-cols-1 gap-3">
          <Field label="Board">
            {({ id }) => (
              <Select id={id} value={board} onChange={(e) => setBoard(e.target.value)}>
                <option value="">Any board</option>
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
                <option value="">Any exam</option>
                {exams.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Year" hint="Any year unless set.">
            {({ id }) => (
              <TextInput
                id={id}
                type="number"
                min={1900}
                max={2200}
                placeholder="Any"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            )}
          </Field>
        </div>

        {/* Mandatory / excluded */}
        {(["mandatory", "excluded"] as const).map((kind) => {
          const ids = kind === "mandatory" ? mandatoryIds : excludedIds;
          const setIds = kind === "mandatory" ? setMandatoryIds : setExcludedIds;
          const other = kind === "mandatory" ? excludedIds : mandatoryIds;
          const Icon = kind === "mandatory" ? Pin : Ban;
          return (
            <div key={kind} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  {kind === "mandatory" ? "Mandatory Questions" : "Excluded Questions"}
                </p>
                <button
                  type="button"
                  onClick={() => setPicker(picker === kind ? null : kind)}
                  className="shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {picker === kind ? "Done" : "Select questions"}
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

        {/* Randomization */}
        <div className="rounded-lg border border-slate-200 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <Shuffle className="h-3.5 w-3.5 text-slate-400" />
            Randomization
          </p>
          <div className="mt-1.5 flex flex-col gap-1 text-sm text-slate-700">
            {(
              [
                ["selection", "Randomize question selection"],
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

        <Field label="Target Total Marks" hint="Optional. Leave blank to let the selected questions decide.">
          {({ id }) => (
            <TextInput
              id={id}
              type="number"
              min={0}
              value={targetMarks}
              onChange={(e) => setTargetMarks(e.target.value)}
            />
          )}
        </Field>

        <Button variant="secondary" onClick={resetAdvanced} className="self-start">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset advanced settings
        </Button>
      </Section>

      {/* ---- 9. Generation Summary ---- */}
      <Section icon={ClipboardCheck} title="Generation Summary" value={summaryBusy ? "Checking…" : undefined}>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">
            {totalNum} Question{totalNum === 1 ? "" : "s"} · {targetMarks || summary?.totalMarks || "—"} Marks
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500">Difficulty</dt>
            <dd className="text-slate-700">{difficultySummary}</dd>
            <dt className="text-slate-500">Type</dt>
            <dd className="text-slate-700">{typeSummary}</dd>
            <dt className="text-slate-500">Coverage</dt>
            <dd className="text-slate-700">
              {selectedChapters.length} chapter{selectedChapters.length === 1 ? "" : "s"} · {coverageSummary}
            </dd>
            <dt className="text-slate-500">Previous</dt>
            <dd className="text-slate-700">{previousSummary}</dd>
            <dt className="text-slate-500">Approved in scope</dt>
            <dd className="text-slate-700">
              {approvedInScope !== null ? `${approvedInScope} question${approvedInScope === 1 ? "" : "s"}` : "—"}
            </dd>
            <dt className="text-slate-500">Eligible for generation</dt>
            <dd className="text-slate-700">
              {dryRunOk
                ? `enough (≥ ${totalNum})`
                : eligibleForGeneration !== null
                  ? `${eligibleForGeneration} question${eligibleForGeneration === 1 ? "" : "s"}`
                  : summaryBusy
                    ? "checking…"
                    : "—"}
            </dd>
          </dl>
        </div>

        {/* Readiness */}
        {!canRun ? (
          <p className="text-xs text-slate-500">Select at least one chapter and a question count.</p>
        ) : summaryBusy && !summary && !summaryError ? (
          <p className="text-xs text-slate-500">Checking availability…</p>
        ) : dryRunOk ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Ready to regenerate — {approvedInScope ?? "—"} approved in scope, {totalNum} requested
          </p>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <p className="flex items-center gap-1.5 font-medium">
              <TriangleAlert className="h-3.5 w-3.5" />
              Not enough questions
            </p>
            <p className="mt-1">
              {totalNum} questions requested, but only {eligibleForGeneration ?? "fewer"} are eligible with the current
              settings.
            </p>
            <p className="mt-1">{shortfallCause()}</p>
          </div>
        )}

        {advisories.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <p className="font-medium">Best available match</p>
            <ul className="mt-1 flex flex-col gap-1">
              {advisories.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Active restrictions (§16) */}
        <div className="rounded-lg border border-slate-200 p-2.5 text-xs">
          {activeRestrictions.length === 0 ? (
            <p className="text-slate-500">Using default settings.</p>
          ) : (
            <>
              <p className="font-medium text-slate-700">Active restrictions</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-slate-600">
                {activeRestrictions.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            <span className="font-medium text-slate-600">Approved in scope</span> is the broad availability for the
            category, subject and chapters. <span className="font-medium text-slate-600">Eligible for generation</span>{" "}
            is what remains after every filter above.
          </span>
        </p>
      </Section>

      {/* ---- 10. Regenerate Paper ---- */}
      {view.canRegenerate ? (
        <div className="sticky bottom-0 z-10 -mx-6 -mb-6 border-t border-slate-200 bg-card px-6 pb-6 pt-3">
          <Button loading={busy} disabled={!canRun} onClick={regenerate} className="w-full py-2.5">
            <Sparkles className="h-4 w-4" />
            Regenerate Paper
          </Button>
          {!canRun ? (
            <p className="mt-1.5 text-center text-xs text-slate-500">
              Select at least one chapter and a question count.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
    </SectionBus.Provider>
  );
}
