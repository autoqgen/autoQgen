"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleCheck,
  FileText,
  Gauge,
  Hash,
  History,
  LayoutTemplate,
  ListChecks,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Alert, Button, Card, Field, Select, Spinner, TextInput, UnsavedChangesModal, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { DIFFICULTIES, QUESTION_TYPES } from "@/types/question";

/**
 * Smart question generation — the New Paper builder.
 *
 * "Simple by default, powerful when needed." The everyday decisions (title,
 * type, taxonomy, count, difficulty, question type, previous questions) are the
 * whole default view; every existing knob still lives under Advanced settings.
 *
 * The generation payload, the dry-run availability check, the submit flow and
 * `buildSpec()` are unchanged — the simple controls are presentation over the
 * same state the advanced editors write to, so the server always receives a
 * backend-compatible spec and the Best Match engine behaves exactly as before.
 */

const GEN_TYPES = QUESTION_TYPES.slice(0, 6) as readonly string[];

const COUNT_PRESETS = ["5", "10", "15", "20", "25", "30", "50"] as const;

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

const TYPE_LABELS: Record<string, string> = {
  MCQ: "MCQ",
  MULTIPLE_CORRECT: "Multiple Correct",
  TRUE_FALSE: "True / False",
  SHORT: "Short",
  WRITTEN: "Written",
  FILL_BLANK: "Fill Blank",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  EXPERT: "Expert",
};

/** Starting point offered when a teacher opens the Custom difficulty editor. */
const CUSTOM_DIFFICULTY_SEED: PctMap = { EASY: "40", MEDIUM: "40", HARD: "20", EXPERT: "" };

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
interface PickerCreativeQuestion {
  _id: string;
  stimulus: string;
  difficulty: string | null;
  totalMarks: number;
  questions: { text: string; marks: number }[];
}
interface GenWarning {
  code: string;
  message: string;
}
interface PatternTemplate {
  _id: string;
  name: string;
  generationSpec: Record<string, unknown>;
  designConfig: Record<string, unknown>;
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

const SHORTFALL_CODES = new Set([
  "BUCKET_SHORTFALL",
  "DIFFICULTY_SHORTFALL",
  "TYPE_SHORTFALL",
  "CHAPTER_SHORTFALL",
]);

/** Engine warning codes → plain sentences. Codes are never shown to the user. */
function friendlyWarnings(warnings: GenWarning[], requested: number, eligible: number): string[] {
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

/** A hard error message from the dry-run / generate call → friendly guidance. */
function friendlyError(message: string): string {
  if (/no approved questions|not enough eligible|eligible question/i.test(message)) {
    return "Not enough questions are available for the current selection. Try adding another chapter, using a broader question type, or relaxing an advanced restriction.";
  }
  return message;
}

const GEN_TYPE_SHORT: Record<string, string> = {
  MCQ: "MCQ",
  MULTIPLE_CORRECT: "MCQ+",
  TRUE_FALSE: "T/F",
  SHORT: "Short",
  WRITTEN: "Written",
  FILL_BLANK: "Fill",
  MATCHING: "Match",
  ASSERTION_REASON: "A/R",
};

/** "MCQ 20 • Short 5 • 100 Marks" one-liner for a template's saved pattern. */
function templateSummaryLine(spec: Record<string, unknown> | undefined): string {
  if (!spec) return "";
  const parts: string[] = [];
  const types = Array.isArray(spec.typeDistribution) ? spec.typeDistribution : [];
  for (const t of types as { type?: string; count?: number }[]) {
    if (t?.type && t.count) parts.push(`${GEN_TYPE_SHORT[t.type] ?? t.type} ${t.count}`);
  }
  if (parts.length === 0) {
    const total = Number(spec.totalQuestions);
    if (Number.isFinite(total) && total > 0) parts.push(`${total} question${total === 1 ? "" : "s"}`);
  }
  const marks = spec.totalMarks;
  if (marks != null && marks !== "" && Number.isFinite(Number(marks))) parts.push(`${marks} Marks`);
  return parts.join(" • ");
}

/* ------------------------------ UI atoms ------------------------------ */

function SectionCard({
  icon: Icon,
  title,
  hint,
  right,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        {right}
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** `40% · 10 questions` percentage input row used by the Custom editors. */
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
        <div className="flex items-center gap-2">
          <TextInput id={id} type="number" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="text-xs text-slate-500">%</span>
        </div>
      )}
    </Field>
  );
}

/** Compact searchable chapter multi-select with organization-scoped counts. */
function ChapterSelect({
  options,
  selected,
  counts,
  onToggle,
  disabled,
}: {
  options: TaxonomyOption[];
  selected: string[];
  counts: Record<string, number>;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const summary =
    selected.length === 0
      ? "Select chapters"
      : selected
          .map((id) => options.find((o) => o._id === id)?.name)
          .filter(Boolean)
          .join(" · ");

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm disabled:bg-slate-100 disabled:opacity-60 ${
          selected.length === 0 ? "border-slate-300 text-slate-500" : "border-slate-300 text-slate-800"
        }`}
      >
        <span className="flex-1 truncate">{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chapters"
              aria-label="Search chapters"
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">No chapters match that search.</li>
            ) : (
              shown.map((c) => {
                const active = selected.includes(c._id);
                const n = counts[c._id];
                return (
                  <li key={c._id} role="option" aria-selected={active}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="accent-brand-600"
                        checked={active}
                        onChange={() => onToggle(c._id)}
                      />
                      <span className="flex-1 truncate text-slate-700">{c.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {n === undefined ? "—" : `${n} question${n === 1 ? "" : "s"}`}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Compact searchable single-select for Question Pattern Templates. */
function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  disabled,
}: {
  templates: PatternTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates;
  }, [templates, query]);

  const selected = templates.find((t) => t._id === selectedId);
  const showSearch = templates.length > 6;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left text-sm disabled:bg-slate-100 disabled:opacity-60 ${
          selected ? "text-slate-800" : "text-slate-500"
        }`}
      >
        <span className="flex-1 truncate">{selected ? selected.name : "No template selected"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-card shadow-lg">
          {showSearch ? (
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates"
                aria-label="Search templates"
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          ) : null}
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {selectedId ? (
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                >
                  No template
                </button>
              </li>
            ) : null}
            {shown.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">No templates match that search.</li>
            ) : (
              shown.map((t) => {
                const active = t._id === selectedId;
                const line = templateSummaryLine(t.generationSpec);
                return (
                  <li key={t._id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t._id);
                        setOpen(false);
                      }}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-50 ${
                        active ? "bg-brand-50" : ""
                      }`}
                    >
                      <span className="text-sm font-medium text-slate-800">{t.name}</span>
                      {line ? <span className="text-xs text-slate-500">{line}</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ Component ------------------------------ */

export default function PaperBuilder({
  templatesEnabled = false,
  canManageTemplates = false,
}: {
  /** Whether the actor may view/load Question Pattern Templates (`template:read`). */
  templatesEnabled?: boolean;
  /** Whether the actor may create templates (`template:manage`) — controls the empty-state action only. */
  canManageTemplates?: boolean;
} = {}) {
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

  // --- organization-scoped availability (from /api/questions/availability) ---
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [subjectCount, setSubjectCount] = useState<number | null>(null);
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});

  // --- counts & distributions (payload state — unchanged shape) ---
  const [total, setTotal] = useState("25");
  const [countCustom, setCountCustom] = useState(false); // "25" is a preset
  const totalNum = Math.max(0, Number(total) || 0);

  const [difficultyChoice, setDifficultyChoice] = useState<"balanced" | "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "custom">(
    "balanced",
  );
  const [difficultyPct, setDifficultyPct] = useState<PctMap>({});

  const [typeChoice, setTypeChoice] = useState<"mix" | (typeof GEN_TYPES)[number] | "custom">("mix");
  const [typePct, setTypePct] = useState<PctMap>({});

  const [chapterMode, setChapterMode] = useState<"auto" | "custom">("auto");
  const [chapterPct, setChapterPct] = useState<PctMap>({});

  // --- previous questions ---
  // `prevUsage` is the single master switch (Auto / Don't use / a percentage);
  // `prevPreference` (Balanced|Prefer) is a secondary refinement that only
  // applies when a percentage is chosen. This makes contradictory combinations
  // ("100%" + "Don't use") unrepresentable.
  const [prevUsage, setPrevUsage] = useState<"auto" | "off" | "10" | "20" | "30" | "50" | "100">("auto");
  const [prevPreference, setPrevPreference] = useState<"balanced" | "prefer">("balanced");
  const [prevRange, setPrevRange] = useState("0");
  const [excludeRecent, setExcludeRecent] = useState("0");

  // --- mandatory / excluded ---
  const [pool, setPool] = useState<PickerQuestion[]>([]);
  const [mandatoryIds, setMandatoryIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState<"mandatory" | "excluded" | null>(null);

  // --- creative questions ---
  const [cqPool, setCqPool] = useState<PickerCreativeQuestion[]>([]);
  const [selectedCqIds, setSelectedCqIds] = useState<string[]>([]);
  const [cqPickerOpen, setCqPickerOpen] = useState(false);

  // --- randomization ---
  const [rndSelection, setRndSelection] = useState(true);
  const [rndOrder, setRndOrder] = useState(true);
  const [rndOptions, setRndOptions] = useState(true);

  // --- disclosure ---
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // --- question pattern templates (starting point only; never mutated here) ---
  const [templates, setTemplates] = useState<PatternTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(templatesEnabled);
  const [templatesError, setTemplatesError] = useState(false);
  const [templateId, setTemplateId] = useState("");
  // Design config carried from a loaded template, persisted with the paper on
  // generate. `null` => the server applies its stored default.
  const [templateDesign, setTemplateDesign] = useState<Record<string, unknown> | null>(null);

  // --- flow ---
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{ eligibleCount: number } | null>(null);
  const [summaryError, setSummaryError] = useState("");
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

  /* ---- Question Pattern Templates (optional starting point) ---- */

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(false);
    const r = await apiFetch<PatternTemplate[]>("/api/question-templates?limit=200");
    setTemplatesLoading(false);
    if (r.success) {
      setTemplates(r.data);
    } else {
      setTemplatesError(true);
    }
  }, []);

  useEffect(() => {
    if (templatesEnabled) queueMicrotask(() => void loadTemplates());
  }, [templatesEnabled, loadTemplates]);

  useEffect(() => {
    if (!category) {
      queueMicrotask(() => {
        setSubjects([]);
        setCategoryCount(null);
      });
      return;
    }
    void apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${category}`).then((r) =>
      setSubjects(r.success ? r.data : []),
    );
    void apiFetch<{ total: number; chapters: Record<string, number> }>(
      `/api/questions/availability?category=${category}`,
    ).then((r) => setCategoryCount(r.success ? r.data.total : null));
  }, [category]);

  useEffect(() => {
    if (!subject) {
      queueMicrotask(() => {
        setChapters([]);
        setSelectedChapters([]);
        setPool([]);
        setCqPool([]);
        setSelectedCqIds([]);
        setSubjectCount(null);
        setChapterCounts({});
      });
      return;
    }
    void apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subject}`).then((r) =>
      setChapters(r.success ? r.data : []),
    );
    void apiFetch<PickerQuestion[]>(`/api/questions?status=APPROVED&subject=${subject}&limit=100`).then((r) =>
      setPool(r.success ? r.data : []),
    );
    void apiFetch<PickerCreativeQuestion[]>(`/api/creative-questions?status=APPROVED&subject=${subject}&limit=100`).then((r) =>
      setCqPool(r.success ? r.data : []),
    );
    // One aggregation: subject total + per-chapter counts, organization-scoped.
    void apiFetch<{ total: number; chapters: Record<string, number> }>(
      `/api/questions/availability?category=${category}&subject=${subject}`,
    ).then((r) => {
      if (r.success) {
        setSubjectCount(r.data.total);
        setChapterCounts(r.data.chapters);
      } else {
        setSubjectCount(null);
        setChapterCounts({});
      }
    });
  }, [subject, category]);

  /* --------------------------- build the spec ---------------------------- */
  // Unchanged payload contract. The simple pickers only decide what goes into
  // `difficultyPct` / `typePct` and the previous-question fields before this runs.

  // Auto → let the engine decide (mode "allow", no cap); Off → mode "exclude";
  // a percentage → mode "allow" (Balanced) or "prefer", capped at that percent.
  const previousPercent = prevUsage === "off" ? 0 : prevUsage === "auto" ? 100 : Number(prevUsage);
  const previousMode: "exclude" | "allow" | "prefer" =
    prevUsage === "off" ? "exclude" : prevPreference === "prefer" ? "prefer" : "allow";
  const prevIsPercent = prevUsage !== "auto" && prevUsage !== "off";

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
        mode: previousMode,
        percent: previousPercent,
        paperRange: Number(prevRange) || 0,
      },
      excludeRecentPapers: Number(excludeRecent) || 0,
      mandatoryQuestionIds: mandatoryIds,
      excludedQuestionIds: excludedIds,
      creativeQuestionIds: selectedCqIds,
      randomize: { selection: rndSelection, order: rndOrder, options: rndOptions },
      status: "APPROVED" as const,
    };
  }, [
    category, subject, selectedChapters, totalNum, difficultyPct, typePct, chapterMode, chapterPct,
    previousMode, previousPercent, prevRange, excludeRecent, mandatoryIds, excludedIds, selectedCqIds,
    rndSelection, rndOrder, rndOptions,
  ]);

  /* ----------------------------- live summary --------------------------- */

  useEffect(() => {
    if (!category || !subject || selectedChapters.length === 0 || totalNum <= 0) {
      queueMicrotask(() => {
        setSummary(null);
        setSummaryError("");
      });
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
      setSummaryError(r.success ? "" : friendlyError(r.error.message));
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
      json: {
        title,
        instructions: "",
        durationMinutes: null,
        paperType,
        spec: buildSpec(),
        // Only sent when a template was loaded; the server falls back to its
        // stored default otherwise. Always the CURRENT config, never re-read
        // from the saved template.
        ...(templateDesign ? { designConfig: templateDesign } : {}),
      },
    });

    setBusy(false);
    if (!r.success) {
      setErrors(fieldErrors(r));
      const friendly = friendlyError(r.error.message);
      setError(friendly);
      toast.error("Could not generate the paper", { description: friendly });
      return;
    }
    const paperId = r.data.paper._id;
    setResult({ data: r.data.result, paperId });
    toast.success("Paper generated successfully", {
      description: `${r.data.result.selected} questions selected using the best available matches.`,
      duration: 7000,
      action: { label: "View Paper", onClick: () => router.push(`/dashboard/papers/${paperId}`) },
    });
  }, [title, paperType, buildSpec, templateDesign, toast, router]);

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
  const pctSum = (m: PctMap) => Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0);

  function toggleId(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function chooseDifficulty(value: typeof difficultyChoice) {
    setDifficultyChoice(value);
    if (value === "balanced") setDifficultyPct({});
    else if (value === "custom") setDifficultyPct((p) => (pctSum(p) > 0 ? p : { ...CUSTOM_DIFFICULTY_SEED }));
    else setDifficultyPct({ [value]: "100" });
  }

  function chooseType(value: typeof typeChoice) {
    setTypeChoice(value);
    if (value === "mix" || value === "custom") {
      if (value === "mix") setTypePct({});
    } else {
      setTypePct({ [value]: "100" });
    }
  }

  /**
   * Load a Question Pattern Template as a STARTING POINT. Every value below is
   * copied into this page's own local state — the saved template is never
   * touched, and the user can change anything before generating.
   */
  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t._id === id);
    if (!id || !tpl) {
      setTemplateDesign(null);
      return;
    }
    const spec = tpl.generationSpec ?? {};
    const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
    const asNum = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

    const count = asNum(spec.totalQuestions) ?? totalNum;
    setTotal(String(count));
    setCountCustom(!COUNT_PRESETS.includes(String(count) as (typeof COUNT_PRESETS)[number]));

    if (typeof spec.paperType === "string") setPaperType(spec.paperType);
    setCategory(typeof spec.category === "string" ? spec.category : "");
    setSubject(typeof spec.subject === "string" ? spec.subject : "");
    setSelectedChapters(asArr(spec.chapters));

    const diff = Array.isArray(spec.difficultyDistribution) ? spec.difficultyDistribution : [];
    if (diff.length === 0) {
      chooseDifficulty("balanced");
    } else {
      setDifficultyChoice("custom");
      setDifficultyPct(
        Object.fromEntries(
          (diff as { difficulty?: string; count?: number }[])
            .filter((d) => d.difficulty)
            .map((d) => [d.difficulty as string, String(Math.round(((d.count ?? 0) / (count || 1)) * 100))]),
        ),
      );
    }

    const types = Array.isArray(spec.typeDistribution) ? spec.typeDistribution : [];
    if (types.length === 0) {
      chooseType("mix");
    } else {
      setTypeChoice("custom");
      setTypePct(
        Object.fromEntries(
          (types as { type?: string; count?: number }[])
            .filter((t) => t.type)
            .map((t) => [t.type as string, String(Math.round(((t.count ?? 0) / (count || 1)) * 100))]),
        ),
      );
    }

    const chapterDist = Array.isArray(spec.chapterDistribution) ? spec.chapterDistribution : [];
    if (chapterDist.length > 0) {
      setChapterMode("custom");
      setChapterPct(
        Object.fromEntries(
          (chapterDist as { chapter?: string; count?: number }[])
            .filter((c) => c.chapter)
            .map((c) => [c.chapter as string, String(Math.round(((c.count ?? 0) / (count || 1)) * 100))]),
        ),
      );
    } else {
      setChapterMode("auto");
      setChapterPct({});
    }

    const pq = (spec.previousQuestions ?? {}) as { mode?: string; percent?: number; paperRange?: number };
    if (pq.mode === "exclude") {
      setPrevUsage("off");
    } else {
      const p = asNum(pq.percent);
      setPrevUsage(p != null && p < 100 && ["10", "20", "30", "50"].includes(String(p)) ? (String(p) as typeof prevUsage) : "auto");
      setPrevPreference(pq.mode === "prefer" ? "prefer" : "balanced");
    }
    if (pq.paperRange != null) setPrevRange(String(pq.paperRange));
    if (asNum(spec.excludeRecentPapers) != null) setExcludeRecent(String(asNum(spec.excludeRecentPapers)));

    const rnd = (spec.randomize ?? {}) as { selection?: boolean; order?: boolean; options?: boolean };
    setRndSelection(rnd.selection ?? true);
    setRndOrder(rnd.order ?? false);
    setRndOptions(rnd.options ?? false);

    setTemplateDesign(tpl.designConfig ?? null);
    toast.success(`Loaded template: ${tpl.name}`);
  }

  /* --------------------------- derived display ------------------------ */

  const selectedChapterCountSum = selectedChapters.reduce((s, id) => s + (chapterCounts[id] ?? 0), 0);
  const eligible = summary?.eligibleCount ?? null;
  // Prefer the authoritative dry-run count; fall back to the per-chapter sum
  // until it resolves.
  const availableForScope = eligible ?? (selectedChapters.length > 0 ? selectedChapterCountSum : null);
  const enough = availableForScope === null ? null : availableForScope >= totalNum;

  const difficultySummary =
    difficultyChoice === "balanced"
      ? "Balanced"
      : difficultyChoice === "custom"
        ? diffCounts.map((d) => `${DIFFICULTY_LABELS[d.key] ?? d.key} ${d.count}`).join(" · ") || "Custom"
        : DIFFICULTY_LABELS[difficultyChoice] ?? difficultyChoice;

  const typeSummary =
    typeChoice === "mix"
      ? "Mix"
      : typeChoice === "custom"
        ? typeCounts.map((t) => `${TYPE_LABELS[t.key] ?? t.key} ${t.count}`).join(" · ") || "Custom"
        : TYPE_LABELS[typeChoice] ?? typeChoice;

  const previousSummary =
    prevUsage === "auto"
      ? "Auto"
      : prevUsage === "off"
        ? "Not used"
        : `${prevPreference === "prefer" ? "Prefer · " : ""}up to ${prevUsage}% · ${countFor(prevUsage, totalNum)}`;

  const diffTotal = pctSum(difficultyPct);
  const typeTotal = pctSum(typePct);
  const categoryName = categories.find((c) => c._id === category)?.name ?? "";
  const subjectName = subjects.find((s) => s._id === subject)?.name ?? "";
  const activeTemplate = templates.find((t) => t._id === templateId) ?? null;

  /* -------------------------------- render --------------------------- */

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Sparkles className="h-5 w-5 text-brand-600" />
          Smart Question Generation
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Build a paper using the best available questions from your organization.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <span aria-hidden>ℹ</span>
          <span>
            Filters are flexible. AutoQgen uses the closest available questions from your organization
            to build the requested paper.
          </span>
        </p>
      </header>

      {/* 0. Start from a template (optional) */}
      {templatesEnabled ? (
        <SectionCard
          icon={LayoutTemplate}
          title="Start from a Template"
          hint="Quickly start with a predefined question pattern. Optional — you can configure everything manually."
        >
          {templatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner label="Loading templates" />
            </div>
          ) : templatesError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span>Unable to load templates.</span>
              <Button variant="secondary" onClick={() => void loadTemplates()} className="py-1 px-3 text-xs">
                Retry
              </Button>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm">
              <p className="font-medium text-slate-700">No question pattern templates yet.</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Create a reusable template to quickly configure future papers.
              </p>
              {canManageTemplates ? (
                <Button
                  variant="secondary"
                  onClick={() => router.push("/dashboard/templates/new")}
                  className="mt-3 py-1 px-3 text-xs"
                >
                  Create Template
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="Select a question pattern">
                {() => (
                  <TemplatePicker
                    templates={templates}
                    selectedId={templateId}
                    onSelect={applyTemplate}
                  />
                )}
              </Field>

              {activeTemplate ? (
                <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2.5 text-sm">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                      Template applied — {activeTemplate.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      General Settings and Paper Design were loaded. Change any setting below before generating —
                      the saved template stays as it is.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyTemplate("")}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* 1. Paper details */}
      <SectionCard icon={FileText} title="Paper Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required error={errors.title}>
            {({ id }) => (
              <TextInput
                id={id}
                value={title}
                placeholder="e.g. Mathematics Practice Test"
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            )}
          </Field>
          <Field label="Paper Type">
            {({ id }) => (
              <Select id={id} value={paperType} onChange={(e) => setPaperType(e.target.value)}>
                {PAPER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Category"
            required
            error={errors.category}
            hint={category && categoryCount !== null ? `${categoryCount} approved questions` : undefined}
          >
            {({ id }) => (
              <Select
                id={id}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubject("");
                }}
              >
                <option value="">Select…</option>
                {categories.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Subject"
            required
            error={errors.subject}
            hint={subject && subjectCount !== null ? `${subjectCount} approved questions` : undefined}
          >
            {({ id }) => (
              <Select id={id} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!category}>
                <option value="">Select…</option>
                {subjects.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </SectionCard>

      {/* 2. Sections / Chapters */}
      <SectionCard
        icon={BookOpen}
        title="Sections / Chapters"
        hint="Counts are live from your organization's approved question bank."
      >
        {!subject ? (
          <p className="text-sm text-slate-500">Choose a subject to list its chapters.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <ChapterSelect
              options={chapters}
              selected={selectedChapters}
              counts={chapterCounts}
              disabled={chapters.length === 0}
              onToggle={(id) => toggleId(selectedChapters, setSelectedChapters, id)}
            />

            {selectedChapters.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedChapters.map((id) => {
                  const name = chapters.find((c) => c._id === id)?.name ?? "Chapter";
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleId(selectedChapters, setSelectedChapters, id)}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                    >
                      {name}
                      <span aria-hidden className="text-brand-400">
                        ×
                      </span>
                      <span className="sr-only">Remove {name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <p className="text-xs text-slate-500">
              {selectedChapters.length > 0
                ? `${selectedChapters.length} selected · `
                : ""}
              {availableForScope !== null
                ? `${availableForScope} question${availableForScope === 1 ? "" : "s"} available`
                : "Select at least one chapter"}
            </p>
            {errors.chapters ? <p className="text-xs text-red-600">{errors.chapters}</p> : null}
          </div>
        )}
      </SectionCard>

      {/* 3. Question Count */}
      <SectionCard icon={Hash} title="Question Count">
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
          <div className="mt-3 max-w-[9rem]">
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
      </SectionCard>

      {/* 4. Difficulty */}
      <SectionCard icon={Gauge} title="Difficulty">
        <div className="max-w-xs">
          <Field label="Difficulty mix">
            {({ id }) => (
              <Select id={id} value={difficultyChoice} onChange={(e) => chooseDifficulty(e.target.value as typeof difficultyChoice)}>
                <option value="balanced">Balanced</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </Select>
            )}
          </Field>
        </div>

        {difficultyChoice === "custom" ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {DIFFICULTIES.map((d) => (
                <PercentRow
                  key={d}
                  label={DIFFICULTY_LABELS[d] ?? d}
                  value={difficultyPct[d] ?? ""}
                  onChange={(v) => setDifficultyPct((p) => ({ ...p, [d]: v }))}
                  count={diffCountOf(d)}
                />
              ))}
            </div>
            {diffTotal > 0 && diffTotal !== 100 ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your difficulty percentages add up to {diffTotal}%. Adjust them to total 100%.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {difficultyChoice === "balanced"
              ? "A reasonable mix is chosen from the available questions."
              : `Prioritizes ${DIFFICULTY_LABELS[difficultyChoice]?.toLowerCase()} questions.`}
          </p>
        )}
        {errors.difficultyDistribution ? (
          <p className="mt-2 text-xs text-red-600">{errors.difficultyDistribution}</p>
        ) : null}
      </SectionCard>

      {/* 5. Question Type */}
      <SectionCard icon={Shapes} title="Question Type">
        <div className="max-w-xs">
          <Field label="Question type">
            {({ id }) => (
              <Select id={id} value={typeChoice} onChange={(e) => chooseType(e.target.value as typeof typeChoice)}>
                <option value="mix">Any type</option>
                {GEN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t] ?? t.replace(/_/g, " ")}
                  </option>
                ))}
                <option value="custom">Custom mix</option>
              </Select>
            )}
          </Field>
        </div>

        {typeChoice === "custom" ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {GEN_TYPES.map((t) => (
                <PercentRow
                  key={t}
                  label={TYPE_LABELS[t] ?? t.replace(/_/g, " ")}
                  value={typePct[t] ?? ""}
                  onChange={(v) => setTypePct((p) => ({ ...p, [t]: v }))}
                  count={typeCountOf(t)}
                />
              ))}
            </div>
            {typeTotal > 0 && typeTotal !== 100 ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your question-type percentages add up to {typeTotal}%. Adjust them to total 100%.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {typeChoice === "mix"
              ? "Any mix of question types is used."
              : `Only ${TYPE_LABELS[typeChoice] ?? typeChoice} questions are selected.`}
          </p>
        )}
        {errors.typeDistribution ? <p className="mt-2 text-xs text-red-600">{errors.typeDistribution}</p> : null}
      </SectionCard>

      {/* 6. Previous Questions */}
      <SectionCard icon={History} title="Previous Questions">
        <div className="max-w-xs">
          <Field label="Previous question usage">
            {({ id }) => (
              <Select
                id={id}
                value={prevUsage}
                onChange={(e) => setPrevUsage(e.target.value as typeof prevUsage)}
              >
                <option value="auto">Auto</option>
                <option value="off">Don&apos;t use</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="30">30%</option>
                <option value="50">50%</option>
                <option value="100">100%</option>
              </Select>
            )}
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {prevUsage === "auto"
            ? "Previous questions are automatically considered when building the paper."
            : prevUsage === "off"
              ? "No previously used questions will be included."
              : `Up to ${prevUsage}% of the paper (${countFor(prevUsage, totalNum)} question${
                  countFor(prevUsage, totalNum) === 1 ? "" : "s"
                }) may be previously used. Preference and limits are in Advanced settings.`}
        </p>
      </SectionCard>

      {/* 7. Advanced settings */}
      <Card>
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center gap-2 text-left"
        >
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <span className="flex-1 text-sm font-semibold text-slate-800">Advanced Settings</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
        </button>

        {advancedOpen ? (
          <div className="mt-5 flex flex-col gap-6">
            {/* Previous question settings */}
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <History className="h-3.5 w-3.5 text-slate-400" />
                Previous Question Settings
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Previous paper range" hint="How far back a question counts as previous.">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={prevRange}
                      onChange={(e) => setPrevRange(e.target.value)}
                      disabled={prevUsage === "off"}
                    >
                      {PREV_RANGE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Exclude questions used in the last N papers" hint="0 = no recency limit">
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
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-700">Preference</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {prevUsage === "off"
                    ? "Previous questions are turned off in the selector above."
                    : prevUsage === "auto"
                      ? "Auto balances previous and fresh questions. Pick a percentage above to set a preference."
                      : "Applies to the percentage chosen above."}
                </p>
                <div className="mt-2 flex flex-col gap-1.5 text-sm text-slate-700">
                  {(
                    [
                      ["balanced", "Balanced"],
                      ["prefer", "Prefer previous questions"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex items-center gap-2 ${prevIsPercent ? "" : "text-slate-400"}`}
                    >
                      <input
                        type="radio"
                        name="prevPreference"
                        disabled={!prevIsPercent}
                        checked={prevPreference === value}
                        onChange={() => setPrevPreference(value)}
                        className="accent-brand-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Coverage */}
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                Coverage
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                {(["auto", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setChapterMode(m)}
                    className={`rounded-md px-2.5 py-1 ${
                      chapterMode === m
                        ? "bg-brand-600 text-white"
                        : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {m === "auto" ? "Automatic chapter split" : "Custom chapter split"}
                  </button>
                ))}
              </div>
              {chapterMode === "custom" && selectedChapters.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {selectedChapters.map((id) => {
                    const chapter = chapters.find((c) => c._id === id);
                    return (
                      <PercentRow
                        key={id}
                        label={chapter?.name ?? "Chapter"}
                        value={chapterPct[id] ?? ""}
                        onChange={(v) => setChapterPct((p) => ({ ...p, [id]: v }))}
                        count={countFor(chapterPct[id] ?? "", totalNum)}
                      />
                    );
                  })}
                </div>
              ) : chapterMode === "custom" ? (
                <p className="mt-2 text-xs text-slate-500">Select chapters above to set their split.</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Questions are spread across the selected chapters by availability.
                </p>
              )}
            </div>

            {/* Mandatory / excluded */}
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ListChecks className="h-3.5 w-3.5 text-slate-400" />
                Mandatory &amp; Excluded Questions
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {(["mandatory", "excluded"] as const).map((kind) => {
                  const ids = kind === "mandatory" ? mandatoryIds : excludedIds;
                  const setIds = kind === "mandatory" ? setMandatoryIds : setExcludedIds;
                  const otherIds = kind === "mandatory" ? excludedIds : mandatoryIds;
                  return (
                    <div key={kind} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium capitalize text-slate-700">{kind} questions</p>
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
            </div>

            {/* Creative Questions (CQ) */}
            <div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                  Creative Questions (CQ) / সৃজনশীল প্রশ্ন
                </p>
                <button
                  type="button"
                  disabled={!subject || cqPool.length === 0}
                  onClick={() => setCqPickerOpen(!cqPickerOpen)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {cqPickerOpen ? "Done" : "Select CQs"}
                </button>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs text-slate-500">
                  {selectedCqIds.length} CQ{selectedCqIds.length === 1 ? "" : "s"} selected
                </p>
                {selectedCqIds.length > 0 ? (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    +{selectedCqIds.length * 10} marks (10 marks each)
                  </span>
                ) : null}
              </div>

              {cqPickerOpen ? (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/50 p-2">
                  {cqPool.length === 0 ? (
                    <p className="p-2 text-xs text-slate-500">No approved creative questions for this subject.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {cqPool.map((cq) => {
                        const checked = selectedCqIds.includes(cq._id);
                        return (
                          <li key={cq._id} className="flex items-start gap-2.5 p-2 text-xs rounded hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-brand-600"
                              checked={checked}
                              onChange={() => {
                                setSelectedCqIds((prev) =>
                                  checked ? prev.filter((id) => id !== cq._id) : [...prev, cq._id],
                                );
                              }}
                            />
                            <div className="flex-1">
                              <span className="text-slate-800 font-medium line-clamp-2">
                                {cq.stimulus}
                              </span>
                              <div className="mt-1 flex items-center gap-2 text-slate-500">
                                <span className="font-semibold text-brand-600">10 Marks</span>
                                <span>·</span>
                                <span>4 parts (ক, খ, গ, ঘ)</span>
                                {cq.difficulty ? (
                                  <>
                                    <span>·</span>
                                    <span>{cq.difficulty}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            {/* Randomization */}
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                Randomization
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
                {(
                  [
                    [rndSelection, setRndSelection, "Randomize question selection"],
                    [rndOrder, setRndOrder, "Randomize question order"],
                    [rndOptions, setRndOptions, "Randomize MCQ options"],
                  ] as const
                ).map(([value, setValue, label], i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={value}
                      onChange={(e) => setValue(e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* 8. Availability / readiness */}
      <SectionCard icon={CircleCheck} title="Availability" right={summaryBusy ? <Spinner label="Checking" /> : null}>
        {!canGenerate ? (
          <p className="text-sm text-slate-500">
            Fill in the title, category, subject and at least one chapter to check availability.
          </p>
        ) : summaryError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-1.5 font-medium">
              <TriangleAlert className="h-4 w-4" />
              Not enough questions for this selection
            </p>
            <p className="mt-1 text-xs">{summaryError}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-baseline gap-2">
              {enough ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span className={enough ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                {availableForScope ?? "—"} question{availableForScope === 1 ? "" : "s"} available
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{totalNum} requested</span>
            </div>
            {enough ? (
              <p className="text-xs text-emerald-700">Ready to generate.</p>
            ) : (
              <div className="text-xs text-amber-800">
                <p>
                  Only {availableForScope} question{availableForScope === 1 ? "" : "s"} are currently available within the
                  selected scope. You can still generate — the closest available questions will be used — or:
                </p>
                <ul className="mt-1 list-disc pl-5">
                  <li>Select another chapter</li>
                  <li>Use a broader question type</li>
                  <li>Relax previous-question restrictions in Advanced settings</li>
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          Filters are flexible. AutoQgen uses the closest available questions from your organization to build the
          requested paper.
        </p>
      </SectionCard>

      {/* Paper summary */}
      <Card className="border-brand-200 bg-brand-50/40">
        <h2 className="text-sm font-semibold text-slate-800">Paper Summary</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-lg font-semibold text-slate-900">{totalNum} questions</p>
            <p className="text-slate-600">
              {categoryName || "—"} · {subjectName || "—"}
            </p>
            {selectedChapters.length > 0 ? (
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedChapters
                  .map((id) => chapters.find((c) => c._id === id)?.name)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500">Difficulty</dt>
            <dd className="text-slate-700">{difficultySummary}</dd>
            <dt className="text-slate-500">Question Type</dt>
            <dd className="text-slate-700">{typeSummary}</dd>
            <dt className="text-slate-500">Previous Questions</dt>
            <dd className="text-slate-700">{previousSummary}</dd>
            <dt className="text-slate-500">Available</dt>
            <dd className="text-slate-700">
              {availableForScope !== null ? `${availableForScope} questions` : "—"}
            </dd>
          </dl>
        </div>

        <div className="mt-5">
          <Button
            loading={busy}
            disabled={!canGenerate}
            onClick={generate}
            className={`w-full py-2.5 text-base ${
              canGenerate
                ? "bg-brand-600 text-white shadow-md shadow-brand-500/20 hover:bg-brand-700"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Generate Question Paper
          </Button>
          {!canGenerate ? (
            <p className="mt-2 text-center text-xs text-slate-500">
              Add a title, category, subject and at least one chapter to continue.
            </p>
          ) : null}
        </div>
      </Card>

      {/* Result */}
      {result ? (
        <Card>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
            <CircleCheck className="h-4 w-4" />
            Paper generated successfully
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {result.data.selected} questions selected using the best available matches.
          </p>

          {friendlyWarnings(result.data.warnings, result.data.requested, result.data.eligibleCount).length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {friendlyWarnings(result.data.warnings, result.data.requested, result.data.eligibleCount).map((m, i) => (
                <li key={i} className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                  {m}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.push(`/dashboard/papers/${result.paperId}`)}>View Paper</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Generate another
            </Button>
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
