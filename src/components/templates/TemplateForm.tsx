"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  BookOpen,
  FileText,
  Gauge,
  Hash,
  History,
  LayoutTemplate,
  Palette,
  Shapes,
  Shuffle,
} from "lucide-react";

import { Alert, Button, Card, Field, Select, TextInput, UnsavedChangesModal, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { DIFFICULTIES, QUESTION_TYPES } from "@/types/question";
import {
  DEFAULT_GENERATION_SETTINGS,
  evenChapterSplit,
  normalizeGenerationSpec,
} from "@/lib/generation/spec-defaults";
import DesignTab, { type PaperDesignConfig } from "@/components/papers/DesignTab";

/**
 * Create / edit a Question Pattern Template.
 *
 * A template bundles a **Question Generation Pattern** (built here from the same
 * primitives, schema shape and helpers the New Paper builder uses) and a **Paper
 * Design** (the existing `<DesignTab>` component, rendered controlled). Saving
 * only writes the template; loading it into the paper builder later copies these
 * values into that page's own state, so a user's paper edits never touch it.
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

const CUSTOM_DIFFICULTY_SEED: PctMap = { EASY: "40", MEDIUM: "40", HARD: "20", EXPERT: "" };

interface TaxonomyOption {
  _id: string;
  name: string;
}
type PctMap = Record<string, string>;

/** Largest-remainder split of `total` across the non-zero percentages — mirrors
 *  the identical helper in `PaperBuilder`/`GenerateTab`. */
function distribute(pct: PctMap, total: number): { key: string; count: number }[] {
  const entries = Object.entries(pct)
    .map(([key, value]) => ({ key, pct: Number(value) || 0 }))
    .filter((e) => e.pct > 0);
  const sum = entries.reduce((s, e) => s + e.pct, 0);
  if (sum <= 0) return [];
  const raw = entries.map((e) => ({ key: e.key, exact: (e.pct / sum) * total }));
  const out = raw.map((r) => ({ key: r.key, count: Math.floor(r.exact) }));
  let assigned = out.reduce((s, r) => s + r.count, 0);
  const byRemainder = raw
    .map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byRemainder) {
    if (assigned >= total) break;
    out[i]!.count += 1;
    assigned += 1;
  }
  return out.filter((r) => r.count > 0);
}

function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function CheckList({
  options,
  selected,
  onToggle,
  empty,
}: {
  options: TaxonomyOption[];
  selected: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
      {options.length === 0 ? (
        <p className="p-2 text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {options.map((o) => (
            <li key={o._id} className="flex items-start gap-2 p-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 accent-brand-600"
                checked={selected.includes(o._id)}
                onChange={() => onToggle(o._id)}
              />
              <span className="text-slate-700">{o.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  mode: "create" | "edit";
  templateId?: string;
  initial?: {
    name: string;
    description: string;
    generationSpec: Record<string, unknown>;
    categoryId: string;
    subjectId: string;
  };
  initialDesign: PaperDesignConfig;
}

type DiffChoice = "balanced" | "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "custom";
type TypeChoice = "mix" | (typeof GEN_TYPES)[number] | "custom";
type PrevUsage = "auto" | "off" | "10" | "20" | "30" | "50" | "100";

export default function TemplateForm({ mode, templateId, initial, initialDesign }: Props) {
  const router = useRouter();
  const toast = useToast();

  const spec0 = initial?.generationSpec ?? {};
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

  /* ---- template details ---- */
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [paperType, setPaperType] = useState<string>(String(spec0.paperType ?? "MODEL_TEST"));

  /* ---- taxonomy ---- */
  const [category, setCategory] = useState(String(spec0.category ?? initial?.categoryId ?? ""));
  const [subject, setSubject] = useState(String(spec0.subject ?? initial?.subjectId ?? ""));
  const [selectedChapters, setSelectedChapters] = useState<string[]>(arr(spec0.chapters));
  const [selectedTopics, setSelectedTopics] = useState<string[]>(arr(spec0.topics));

  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = useState<(TaxonomyOption & { chapter?: string })[]>([]);

  /* ---- counts / distributions ---- */
  const [total, setTotal] = useState(String(num(spec0.totalQuestions, 10)));
  const [countCustom, setCountCustom] = useState(
    !(COUNT_PRESETS as readonly string[]).includes(String(num(spec0.totalQuestions, 10))),
  );
  const totalNum = Math.max(1, Number(total) || 0);
  const [totalMarks, setTotalMarks] = useState(spec0.totalMarks != null ? String(spec0.totalMarks) : "");

  const seedDiff = (): [DiffChoice, PctMap] => {
    const d = Array.isArray(spec0.difficultyDistribution) ? spec0.difficultyDistribution : [];
    if (d.length === 0) return ["balanced", {}];
    const t = num(spec0.totalQuestions, 10) || 1;
    const pct: PctMap = {};
    for (const row of d as { difficulty?: string; count?: number }[]) {
      if (row?.difficulty) pct[row.difficulty] = String(Math.round(((row.count ?? 0) / t) * 100));
    }
    return ["custom", pct];
  };
  const seedType = (): [TypeChoice, PctMap] => {
    const d = Array.isArray(spec0.typeDistribution) ? spec0.typeDistribution : [];
    if (d.length === 0) return ["mix", {}];
    const t = num(spec0.totalQuestions, 10) || 1;
    const pct: PctMap = {};
    for (const row of d as { type?: string; count?: number }[]) {
      if (row?.type) pct[row.type] = String(Math.round(((row.count ?? 0) / t) * 100));
    }
    return ["custom", pct];
  };
  const [difficultyChoice, setDifficultyChoice] = useState<DiffChoice>(seedDiff()[0]);
  const [difficultyPct, setDifficultyPct] = useState<PctMap>(seedDiff()[1]);
  const [typeChoice, setTypeChoice] = useState<TypeChoice>(seedType()[0]);
  const [typePct, setTypePct] = useState<PctMap>(seedType()[1]);

  const [coverage, setCoverage] = useState<"automatic" | "equal">(
    Array.isArray(spec0.chapterDistribution) && spec0.chapterDistribution.length > 0 ? "equal" : "automatic",
  );

  /* ---- previous questions ---- */
  const pq0 = (spec0.previousQuestions ?? {}) as { mode?: string; percent?: number; paperRange?: number };
  const seedPrev = (): PrevUsage => {
    if (pq0.mode === "exclude") return "off";
    const p = num(pq0.percent, 100);
    if (p >= 100) return "auto";
    return (["10", "20", "30", "50"].find((v) => Number(v) === p) as PrevUsage) ?? "auto";
  };
  const [prevUsage, setPrevUsage] = useState<PrevUsage>(seedPrev());
  const [prevPreference, setPrevPreference] = useState<"balanced" | "prefer">(pq0.mode === "prefer" ? "prefer" : "balanced");
  const [prevRange, setPrevRange] = useState(
    pq0.paperRange == null
      ? String(DEFAULT_GENERATION_SETTINGS.previousQuestions.paperRange)
      : String(num(pq0.paperRange, 0)),
  );
  const [excludeRecent, setExcludeRecent] = useState(
    spec0.excludeRecentPapers == null
      ? String(DEFAULT_GENERATION_SETTINGS.excludeRecentPapers)
      : String(num(spec0.excludeRecentPapers, 0)),
  );

  /* ---- randomization ---- */
  const rnd0 = (spec0.randomize ?? {}) as { selection?: boolean; order?: boolean; options?: boolean };
  const [rndSelection, setRndSelection] = useState(rnd0.selection ?? true);
  const [rndOrder, setRndOrder] = useState(rnd0.order ?? false);
  const [rndOptions, setRndOptions] = useState(rnd0.options ?? false);

  /* ---- design ---- */
  const [design, setDesign] = useState<PaperDesignConfig>(initialDesign);
  const designController = useMemo(
    () => ({ value: design, onChange: setDesign, dirty: false, onReset: () => {}, onSaved: () => {} }),
    [design],
  );

  /* ---- flow ---- */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ---------------------------- taxonomy fetch --------------------------- */

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
        setTopics([]);
      });
      return;
    }
    void apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subject}`).then((r) =>
      setChapters(r.success ? r.data : []),
    );
    void apiFetch<(TaxonomyOption & { chapter?: string })[]>(`/api/topics?limit=200&subject=${subject}`).then((r) =>
      setTopics(r.success ? r.data : []),
    );
  }, [subject]);

  const chapterTopics = useMemo(
    () => topics.filter((t) => !t.chapter || selectedChapters.includes(t.chapter)),
    [topics, selectedChapters],
  );

  /* ------------------------------- helpers ------------------------------ */

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function chooseDifficulty(value: DiffChoice) {
    setDifficultyChoice(value);
    if (value === "balanced") setDifficultyPct({});
    else if (value === "custom")
      setDifficultyPct((p) => (Object.values(p).some((v) => Number(v) > 0) ? p : { ...CUSTOM_DIFFICULTY_SEED }));
    else setDifficultyPct({ [value]: "100" });
  }
  function chooseType(value: TypeChoice) {
    setTypeChoice(value);
    if (value === "mix") setTypePct({});
    else if (value === "custom") setTypePct((p) => p);
    else setTypePct({ [value]: "100" });
  }

  const previousPercent = prevUsage === "off" ? 0 : prevUsage === "auto" ? 100 : Number(prevUsage);
  const previousMode: "exclude" | "allow" | "prefer" =
    prevUsage === "off" ? "exclude" : prevPreference === "prefer" ? "prefer" : "allow";

  const buildGenerationSpec = useCallback(() => {
    const normalized = normalizeGenerationSpec({
      category: category || "",
      subject: subject || "",
      chapters: selectedChapters,
      topics: selectedTopics,
      board: null,
      exam: null,
      year: null,
      language: null,
      totalQuestions: totalNum,
      totalMarks: totalMarks ? Number(totalMarks) : null,
      difficultyDistribution: distribute(difficultyPct, totalNum).map((e) => ({ difficulty: e.key, count: e.count })),
      typeDistribution: distribute(typePct, totalNum).map((e) => ({ type: e.key, count: e.count })),
      chapterDistribution: coverage === "equal" ? evenChapterSplit(selectedChapters, totalNum) : [],
      previousQuestions: {
        mode: previousMode,
        percent: previousPercent,
        paperRange: Number(prevRange) || 0,
      },
      excludeRecentPapers: Number(excludeRecent) || 0,
      mandatoryQuestionIds: [],
      excludedQuestionIds: [],
      randomize: { selection: rndSelection, order: rndOrder, options: rndOptions },
    });
    return { ...normalized, paperType, status: "APPROVED" as const };
  }, [
    category, subject, selectedChapters, selectedTopics, totalNum, totalMarks, difficultyPct, typePct,
    coverage, previousMode, previousPercent, prevRange, excludeRecent, rndSelection, rndOrder, rndOptions, paperType,
  ]);

  /* ------------------------------ dirty guard --------------------------- */

  const snapshot = () =>
    JSON.stringify({ name, description, spec: buildGenerationSpec(), design });
  // Captured once from the seeded state, so a pristine form is never "dirty".
  const [baseline, setBaseline] = useState<string>(snapshot);
  const isDirty = snapshot() !== baseline;

  /* -------------------------------- submit ---------------------------- */

  const save = useCallback(async () => {
    if (!name.trim()) {
      setErrors({ name: "Name is required." });
      return false;
    }
    setBusy(true);
    setError("");
    setErrors({});

    const payload = { name: name.trim(), description, generationSpec: buildGenerationSpec(), designConfig: design };
    const r =
      mode === "edit" && templateId
        ? await apiFetch(`/api/question-templates/${templateId}`, { method: "PUT", json: payload })
        : await apiFetch("/api/question-templates", { method: "POST", json: payload });

    setBusy(false);
    if (!r.success) {
      setErrors(fieldErrors(r));
      setError(r.error.message);
      toast.error(mode === "edit" ? "Could not save the template" : "Could not create the template", {
        description: r.error.message,
      });
      return false;
    }
    setBaseline(JSON.stringify({ name, description, spec: buildGenerationSpec(), design }));
    toast.success(mode === "edit" ? "Template updated." : "Template created.");
    router.push("/dashboard/templates");
    return true;
  }, [name, description, design, buildGenerationSpec, mode, templateId, toast, router]);

  const { showLeaveModal, confirmSaveAndLeave, confirmDiscardAndLeave, cancelLeave } = useUnsavedChanges({
    isDirty: isDirty && !busy,
    onSave: async () => save(),
  });

  /* -------------------------------- render --------------------------- */

  const typeSummary =
    typeChoice === "mix"
      ? "Any type"
      : typeChoice === "custom"
        ? distribute(typePct, totalNum)
            .map((t) => `${TYPE_LABELS[t.key] ?? t.key} ${t.count}`)
            .join(" · ") || "Custom"
        : TYPE_LABELS[typeChoice] ?? typeChoice;
  const difficultySummary =
    difficultyChoice === "balanced"
      ? "Balanced"
      : difficultyChoice === "custom"
        ? distribute(difficultyPct, totalNum)
            .map((d) => `${DIFFICULTY_LABELS[d.key] ?? d.key} ${d.count}`)
            .join(" · ") || "Custom"
        : DIFFICULTY_LABELS[difficultyChoice] ?? difficultyChoice;
  const previousSummary =
    prevUsage === "auto" ? "Auto" : prevUsage === "off" ? "Not used" : `${prevPreference === "prefer" ? "Prefer · " : ""}up to ${prevUsage}%`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <LayoutTemplate className="h-5 w-5 text-brand-600" />
          {mode === "edit" ? "Edit Question Pattern Template" : "Create Question Pattern Template"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          A template holds a <strong>Question Generation Pattern</strong> and a <strong>Paper Design</strong>. Save it once,
          then load it whenever you create a paper — every value stays editable before you generate.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* 1. Template details */}
      <SectionCard icon={FileText} title="Template Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template Name" required error={errors.name}>
            {({ id }) => (
              <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 7 Final Exam" required />
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
        </div>
        <div className="mt-4">
          <Field label="Description (optional)">
            {({ id }) => (
              <textarea
                id={id}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When to use this pattern…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </Field>
        </div>
      </SectionCard>

      <div className="flex items-center gap-2 pt-1">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Question Generation Pattern</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* 2. Scope */}
      <SectionCard icon={BookOpen} title="Class, Subject & Coverage" hint="All optional — leave blank for a subject-agnostic template.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class / Category">
            {({ id }) => (
              <Select
                id={id}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubject("");
                  setSelectedChapters([]);
                  setSelectedTopics([]);
                }}
              >
                <option value="">Any</option>
                {categories.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Subject">
            {({ id }) => (
              <Select
                id={id}
                value={subject}
                disabled={!category}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setSelectedChapters([]);
                  setSelectedTopics([]);
                }}
              >
                <option value="">Any</option>
                {subjects.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {subject ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-400">Chapters</p>
              <div className="mt-1.5">
                <CheckList
                  options={chapters}
                  selected={selectedChapters}
                  onToggle={(id) => toggle(selectedChapters, setSelectedChapters, id)}
                  empty="No chapters for this subject."
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Topics</p>
              <div className="mt-1.5">
                <CheckList
                  options={chapterTopics}
                  selected={selectedTopics}
                  onToggle={(id) => toggle(selectedTopics, setSelectedTopics, id)}
                  empty="No topics for the selected chapters."
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 max-w-xs">
          <Field label="Chapter coverage">
            {({ id }) => (
              <Select id={id} value={coverage} onChange={(e) => setCoverage(e.target.value as "automatic" | "equal")}>
                <option value="automatic">Automatic (by availability)</option>
                <option value="equal">Equal split across chapters</option>
              </Select>
            )}
          </Field>
        </div>
      </SectionCard>

      {/* 3. Count & marks */}
      <SectionCard icon={Hash} title="Question Count & Marks">
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
              countCustom ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Custom
          </button>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {countCustom ? (
            <Field label="Number of questions">
              {({ id }) => (
                <TextInput id={id} type="number" min={1} max={500} value={total} onChange={(e) => setTotal(e.target.value)} />
              )}
            </Field>
          ) : (
            <div />
          )}
          <Field label="Total marks (optional)">
            {({ id }) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                placeholder="e.g. 50"
              />
            )}
          </Field>
        </div>
      </SectionCard>

      {/* 4. Difficulty */}
      <SectionCard icon={Gauge} title="Difficulty">
        <div className="max-w-xs">
          <Field label="Difficulty mix">
            {({ id }) => (
              <Select id={id} value={difficultyChoice} onChange={(e) => chooseDifficulty(e.target.value as DiffChoice)}>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DIFFICULTIES.map((d) => (
              <Field key={d} label={`${DIFFICULTY_LABELS[d]} %`}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={0}
                    max={100}
                    value={difficultyPct[d] ?? ""}
                    onChange={(e) => setDifficultyPct((p) => ({ ...p, [d]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
        ) : null}
      </SectionCard>

      {/* 5. Question type */}
      <SectionCard icon={Shapes} title="Question Type">
        <div className="max-w-xs">
          <Field label="Question type">
            {({ id }) => (
              <Select id={id} value={typeChoice} onChange={(e) => chooseType(e.target.value as TypeChoice)}>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {GEN_TYPES.map((t) => (
              <Field key={t} label={`${TYPE_LABELS[t] ?? t.replace(/_/g, " ")} %`}>
                {({ id }) => (
                  <TextInput
                    id={id}
                    type="number"
                    min={0}
                    max={100}
                    value={typePct[t] ?? ""}
                    onChange={(e) => setTypePct((p) => ({ ...p, [t]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
        ) : null}
      </SectionCard>

      {/* 6. Previous questions */}
      <SectionCard icon={History} title="Previous Questions">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Previous question usage">
            {({ id }) => (
              <Select id={id} value={prevUsage} onChange={(e) => setPrevUsage(e.target.value as PrevUsage)}>
                <option value="auto">Auto</option>
                <option value="off">Don&apos;t use</option>
                <option value="10">Up to 10%</option>
                <option value="20">Up to 20%</option>
                <option value="30">Up to 30%</option>
                <option value="50">Up to 50%</option>
                <option value="100">Up to 100%</option>
              </Select>
            )}
          </Field>
          <Field label="Preference">
            {({ id }) => (
              <Select
                id={id}
                value={prevPreference}
                disabled={prevUsage === "auto" || prevUsage === "off"}
                onChange={(e) => setPrevPreference(e.target.value as "balanced" | "prefer")}
              >
                <option value="balanced">Balanced</option>
                <option value="prefer">Prefer previous questions</option>
              </Select>
            )}
          </Field>
          <Field label="Previous paper range">
            {({ id }) => (
              <Select id={id} value={prevRange} disabled={prevUsage === "off"} onChange={(e) => setPrevRange(e.target.value)}>
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
      </SectionCard>

      {/* 7. Randomization */}
      <SectionCard icon={Shuffle} title="Randomization">
        <div className="flex flex-col gap-2 text-sm text-slate-700">
          {(
            [
              [rndSelection, setRndSelection, "Randomize question selection"],
              [rndOrder, setRndOrder, "Randomize question order"],
              [rndOptions, setRndOptions, "Randomize MCQ options"],
            ] as const
          ).map(([value, setValue, label], i) => (
            <label key={i} className="flex items-center gap-2">
              <input type="checkbox" className="accent-brand-600" checked={value} onChange={(e) => setValue(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </SectionCard>

      <div className="flex items-center gap-2 pt-1">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paper Design</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* 8. Paper design — reuses the existing Design sidebar component */}
      <SectionCard icon={Palette} title="Paper Design" hint="Same controls as the paper Design sidebar. English is the default; sections start collapsed.">
        <div className="max-w-md">
          <DesignTab view={{ paperId: "", canSave: false, config: design }} controller={designController} />
        </div>
      </SectionCard>

      {/* 9. Review */}
      <Card className="border-brand-200 bg-brand-50/40">
        <h2 className="text-sm font-semibold text-slate-800">Review</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Name</dt>
          <dd className="text-slate-800">{name || "—"}</dd>
          <dt className="text-slate-500">Questions</dt>
          <dd className="text-slate-800">
            {totalNum}
            {totalMarks ? ` · ${totalMarks} marks` : ""} · {paperType.replace(/_/g, " ").toLowerCase()}
          </dd>
          <dt className="text-slate-500">Difficulty</dt>
          <dd className="text-slate-800">{difficultySummary}</dd>
          <dt className="text-slate-500">Question type</dt>
          <dd className="text-slate-800">{typeSummary}</dd>
          <dt className="text-slate-500">Coverage</dt>
          <dd className="text-slate-800">
            {coverage === "equal" ? "Equal split" : "Automatic"}
            {selectedChapters.length ? ` · ${selectedChapters.length} chapter(s)` : ""}
          </dd>
          <dt className="text-slate-500">Previous questions</dt>
          <dd className="text-slate-800">{previousSummary}</dd>
          <dt className="text-slate-500">Design</dt>
          <dd className="text-slate-800">
            Heading {design.heading.language === "en" ? "English" : "Bangla"} · {design.paper.size} {design.paper.orientation}
          </dd>
        </dl>

        <div className="mt-5 flex gap-2">
          <Button loading={busy} onClick={() => void save()} className="flex-1">
            {mode === "edit" ? "Save Template" : "Create Template"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/dashboard/templates")} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Card>

      <UnsavedChangesModal
        isOpen={showLeaveModal}
        onStay={cancelLeave}
        onDiscard={confirmDiscardAndLeave}
        onSave={() => void confirmSaveAndLeave()}
        canSave={Boolean(name.trim())}
        saving={busy}
        title="Unsaved template"
        description="This template has changes that haven't been saved. Save or discard before leaving?"
      />
    </div>
  );
}
