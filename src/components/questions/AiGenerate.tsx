"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  ExternalLink,
  Gauge,
  Hash,
  ListChecks,
  Pencil,
  Tag,
  Trash,
} from "lucide-react";

import { Alert, Badge, Button, Card, EmptyState, Field, Select, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { AI_QUESTION_TYPES, DIFFICULTIES, type AiQuestionType, type Difficulty } from "@/types/question";

/**
 * AI Generated Questions.
 *
 * Select taxonomy → Generate (server calls Gemini) → review cards with
 * duplicate detection → pick the new/valid ones → Import Selected → saved to
 * the existing Question Bank as DRAFTs.
 *
 * Every authoritative decision (organization, taxonomy, validity, duplicates,
 * status) is made server-side; this component is a convenience layer over
 * /api/questions/ai-generate, /ai-check and /ai-import.
 */

interface TaxonomyOption {
  _id: string;
  name: string;
}

type CandidateStatus = "new" | "duplicate" | "needs_review";

interface NormalisedQuestion {
  type: AiQuestionType;
  difficulty: Difficulty | null;
  question: { text: string };
  options: { id: string; text: string }[];
  answer: { text: string; correctOptions: string[]; booleanAnswer: boolean | null };
  explanation: string;
  marks: number;
}

interface Candidate {
  tempId: string;
  status: CandidateStatus;
  question: NormalisedQuestion;
  issues: string[];
  duplicateOf: string | null;
}

interface GenerateResult {
  organizationId: string;
  organizationName: string;
  model: string;
  taxonomy: {
    categoryId: string;
    categoryName: string;
    subjectId: string;
    subjectName: string;
    chapterId: string;
    chapterName: string;
    topicId: string | null;
    topicName: string | null;
  };
  requested: number;
  generated: number;
  newCount: number;
  duplicateCount: number;
  needsReviewCount: number;
  questions: Candidate[];
}

interface ImportResult {
  received: number;
  imported: number;
  skipped: number;
  errors: { index: number; reason: string }[];
}

const TYPE_LABELS: Record<AiQuestionType, string> = {
  MCQ: "MCQ",
  MULTIPLE_CORRECT: "Multiple correct",
  TRUE_FALSE: "True / False",
  SHORT: "Short answer",
  WRITTEN: "Written",
  FILL_BLANK: "Fill in the blank",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  EXPERT: "Expert",
};

const LANGUAGE_OPTIONS: { value: "any" | "bn" | "en"; label: string }[] = [
  { value: "bn", label: "বাংলা" },
  { value: "en", label: "English" },
  { value: "any", label: "Any" },
];

const OPTION_LETTERS = "ABCDEFGHIJKL".split("");

/** Client-side shape check, mirrors the server's validateAnswerForType. */
function validateCandidate(question: NormalisedQuestion): string[] {
  const issues: string[] = [];
  if (!question.question.text.trim()) issues.push("The question text is empty.");

  if (question.type === "MCQ" || question.type === "MULTIPLE_CORRECT") {
    const filled = question.options.filter((option) => option.text.trim());
    if (filled.length < 2) issues.push("Provide at least two options.");
    if (question.type === "MCQ" && question.answer.correctOptions.length !== 1) {
      issues.push("Mark exactly one option correct.");
    }
    if (question.type === "MULTIPLE_CORRECT" && question.answer.correctOptions.length < 2) {
      issues.push("Mark at least two options correct.");
    }
  } else if (question.type === "TRUE_FALSE") {
    if (typeof question.answer.booleanAnswer !== "boolean") issues.push("Choose True or False.");
  } else if (!question.answer.text.trim()) {
    issues.push("Provide the expected answer.");
  }
  return issues;
}

interface Props {
  available: boolean;
  canImport: boolean;
  categories: TaxonomyOption[];
}

export default function AiGenerate({ available, canImport, categories }: Props) {
  const toast = useToast();

  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = useState<TaxonomyOption[]>([]);

  const [type, setType] = useState<AiQuestionType>("MCQ");
  const [difficulty, setDifficulty] = useState<"" | Difficulty>("MEDIUM");
  const [language, setLanguage] = useState<"any" | "bn" | "en">("bn");
  const [count, setCount] = useState(10);
  const [instruction, setInstruction] = useState("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NormalisedQuestion | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  /* --------------------------- Taxonomy cascade --------------------------- */
  // Child selections are reset in the change handlers below; each effect only
  // syncs the fetched option list for its level.

  useEffect(() => {
    if (!category) {
      queueMicrotask(() => setSubjects([]));
      return;
    }
    let cancelled = false;
    void apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${category}`).then((res) => {
      if (!cancelled) setSubjects(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    if (!subject) {
      queueMicrotask(() => setChapters([]));
      return;
    }
    let cancelled = false;
    void apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subject}`).then((res) => {
      if (!cancelled) setChapters(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  useEffect(() => {
    if (!chapter) {
      queueMicrotask(() => setTopics([]));
      return;
    }
    let cancelled = false;
    void apiFetch<TaxonomyOption[]>(`/api/topics?limit=100&chapter=${chapter}`).then((res) => {
      if (!cancelled) setTopics(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  function selectCategory(value: string) {
    setCategory(value);
    setSubject("");
    setChapter("");
    setTopic("");
  }

  function selectSubject(value: string) {
    setSubject(value);
    setChapter("");
    setTopic("");
  }

  function selectChapter(value: string) {
    setChapter(value);
    setTopic("");
  }

  const canGenerate = Boolean(category && subject && chapter) && !generating && available;

  /* ------------------------------- Generate ------------------------------ */

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError("");
    setImportResult(null);
    setEditingId(null);

    const res = await apiFetch<GenerateResult>("/api/questions/ai-generate", {
      method: "POST",
      json: {
        category,
        subject,
        chapter,
        topic: topic || null,
        type,
        difficulty: difficulty || null,
        language,
        count,
        instruction: instruction.trim(),
      },
    });

    setGenerating(false);

    if (!res.success) {
      setError(res.error.message);
      toast.error(res.error.message);
      return;
    }

    setResult(res.data);
    setCandidates(res.data.questions);
    setSelected(
      new Set(res.data.questions.filter((q) => q.status === "new").map((q) => q.tempId)),
    );
    toast.success(
      `Generated ${res.data.generated} question(s): ${res.data.newCount} new, ${res.data.duplicateCount} duplicate, ${res.data.needsReviewCount} need review.`,
    );
  }

  /* ------------------------------ Selection ----------------------------- */

  function toggle(tempId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  }

  function selectAllNew() {
    setSelected(new Set(candidates.filter((q) => q.status === "new").map((q) => q.tempId)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function removeCard(tempId: string) {
    setCandidates((prev) => prev.filter((q) => q.tempId !== tempId));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
    if (editingId === tempId) {
      setEditingId(null);
      setDraft(null);
    }
  }

  /* -------------------------------- Edit -------------------------------- */

  function startEdit(candidate: Candidate) {
    setEditingId(candidate.tempId);
    setDraft(JSON.parse(JSON.stringify(candidate.question)) as NormalisedQuestion);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit() {
    if (!draft || !editingId || !result) return;

    const issues = validateCandidate(draft);

    // Re-check duplicate status for the edited text, org-scoped, server-side.
    let duplicate = false;
    let duplicateOf: string | null = null;
    if (issues.length === 0) {
      const res = await apiFetch<{ items: { duplicate: boolean; duplicateOf: string | null }[] }>(
        "/api/questions/ai-check",
        {
          method: "POST",
          json: { chapter: result.taxonomy.chapterId, texts: [draft.question.text] },
        },
      );
      if (res.success && res.data.items[0]) {
        duplicate = res.data.items[0].duplicate;
        duplicateOf = res.data.items[0].duplicateOf;
      }
    }

    const status: CandidateStatus =
      issues.length > 0 ? "needs_review" : duplicate ? "duplicate" : "new";

    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.tempId === editingId
          ? { ...candidate, question: draft, issues, status, duplicateOf }
          : candidate,
      ),
    );
    setSelected((prev) => {
      const next = new Set(prev);
      if (status === "new") next.add(editingId);
      else next.delete(editingId);
      return next;
    });
    setEditingId(null);
    setDraft(null);
    toast.success(status === "new" ? "Question updated." : `Question updated — marked ${status.replace("_", " ")}.`);
  }

  function patchDraft(patch: Partial<NormalisedQuestion>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  /* ------------------------------- Import ------------------------------- */

  const selectedCount = selected.size;

  async function importSelected() {
    if (!result || selectedCount === 0 || !canImport) return;
    setImporting(true);
    setImportResult(null);

    const picks = candidates.filter((c) => selected.has(c.tempId) && c.status === "new");

    const res = await apiFetch<ImportResult>("/api/questions/ai-import", {
      method: "POST",
      json: {
        category: result.taxonomy.categoryId,
        subject: result.taxonomy.subjectId,
        chapter: result.taxonomy.chapterId,
        topic: result.taxonomy.topicId,
        language,
        questions: picks.map((c) => ({
          type: c.question.type,
          difficulty: c.question.difficulty,
          question: { text: c.question.question.text },
          options: c.question.options.filter((option) => option.text.trim()),
          answer: {
            text: c.question.answer.text,
            correctOptions: c.question.answer.correctOptions,
            booleanAnswer: c.question.answer.booleanAnswer,
          },
          explanation: c.question.explanation,
          marks: c.question.marks,
        })),
      },
    });

    setImporting(false);

    if (!res.success) {
      toast.error(res.error.message);
      return;
    }

    setImportResult(res.data);

    // Drop the imported ones from the review list.
    const importedTempIds = new Set(picks.slice(0, res.data.imported).map((c) => c.tempId));
    setCandidates((prev) => prev.filter((c) => !importedTempIds.has(c.tempId)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of importedTempIds) next.delete(id);
      return next;
    });

    if (res.data.skipped > 0) {
      toast.warning(`Imported ${res.data.imported}, skipped ${res.data.skipped}.`);
    } else {
      toast.success(`Imported ${res.data.imported} question(s) into the Question Bank.`);
    }
  }

  /* -------------------------------- View -------------------------------- */

  const newRemaining = useMemo(
    () => candidates.filter((c) => c.status === "new").length,
    [candidates],
  );

  if (!available) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <Alert tone="error">
          AI question generation is not configured. Add a <code>GEMINI_API_KEY</code> to the
          environment configuration (<code>.env.local</code>) and restart the server.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />

      {/* ---------------------------- Question Scope ---------------------------- */}
      <Card>
        <SectionTitle icon={<BookOpen className="h-4 w-4 text-brand-600" />} title="Question Scope" />
        <p className="mt-1 text-xs text-slate-500">
          From your organization&apos;s taxonomy only. New questions are placed exactly here.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Category" required>
            {({ id }) => (
              <Select id={id} value={category} onChange={(event) => selectCategory(event.target.value)}>
                <option value="">Select Category</option>
                {categories.map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Subject" required>
            {({ id }) => (
              <Select
                id={id}
                value={subject}
                disabled={!category}
                onChange={(event) => selectSubject(event.target.value)}
              >
                <option value="">Select Subject</option>
                {subjects.map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Chapter" required>
            {({ id }) => (
              <Select
                id={id}
                value={chapter}
                disabled={!subject}
                onChange={(event) => selectChapter(event.target.value)}
              >
                <option value="">Select Chapter</option>
                {chapters.map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Topic">
            {({ id }) => (
              <Select
                id={id}
                value={topic}
                disabled={!chapter}
                onChange={(event) => setTopic(event.target.value)}
              >
                <option value="">None</option>
                {topics.map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {/* --------------------------- Question Settings -------------------------- */}
      <Card>
        <SectionTitle icon={<ListChecks className="h-4 w-4 text-brand-600" />} title="Question Settings" />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Question Type" required>
            {({ id }) => (
              <Select
                id={id}
                value={type}
                onChange={(event) => setType(event.target.value as AiQuestionType)}
              >
                {AI_QUESTION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Difficulty">
            {({ id }) => (
              <Select
                id={id}
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as "" | Difficulty)}
              >
                <option value="">Unset</option>
                {DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Language">
            {({ id }) => (
              <Select
                id={id}
                value={language}
                onChange={(event) => setLanguage(event.target.value as "any" | "bn" | "en")}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Number of Questions">
            {({ id }) => (
              <TextInput
                id={id}
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setCount(Number.isFinite(next) ? Math.min(20, Math.max(1, Math.round(next))) : 10);
                }}
              />
            )}
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Additional Instruction" hint="Optional. e.g. Focus on conceptual questions and avoid repeated wording.">
            {({ id }) => (
              <textarea
                id={id}
                rows={2}
                value={instruction}
                maxLength={500}
                placeholder="Optional…"
                onChange={(event) => setInstruction(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            )}
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={!canGenerate} loading={generating}>
            <Bot className="h-4 w-4" />
            {generating ? "Generating questions..." : "Generate Questions"}
          </Button>
          {!category || !subject || !chapter ? (
            <span className="text-xs text-slate-500">Select a category, subject and chapter first.</span>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------ Results ------------------------------ */}
      {result ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<Bot className="h-4 w-4 text-brand-600" />} title="Generated Questions" />
            <span className="text-xs text-slate-500">model: {result.model}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="slate">{candidates.length} shown</Badge>
            <Badge tone="green">{newRemaining} New</Badge>
            <Badge tone="amber">{candidates.filter((c) => c.status === "duplicate").length} Duplicate</Badge>
            <Badge tone="red">{candidates.filter((c) => c.status === "needs_review").length} Needs review</Badge>
          </div>

          {importResult ? (
            <div className="mt-4">
              <Alert tone={importResult.skipped > 0 ? "info" : "success"}>
                Imported {importResult.imported} of {importResult.received}.{" "}
                {importResult.skipped > 0 ? `${importResult.skipped} skipped.` : "All selected questions saved."}{" "}
                <Link className="font-medium underline" href="/dashboard/questions?aiGenerated=true">
                  View in Question Bank
                </Link>
                {importResult.errors.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-xs">
                    {importResult.errors.map((issue, index) => (
                      <li key={index}>
                        #{issue.index + 1}: {issue.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            </div>
          ) : null}

          {candidates.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={selectAllNew}>
                Select All New
              </Button>
              <Button variant="ghost" onClick={deselectAll}>
                Deselect All
              </Button>
              <span className="ml-auto text-sm font-medium text-slate-600">{selectedCount} selected</span>
              {canImport ? (
                <Button onClick={importSelected} loading={importing} disabled={selectedCount === 0}>
                  Import Selected Questions
                </Button>
              ) : (
                <span className="text-xs text-amber-700">You do not have permission to import.</span>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Nothing to review" body="Generate a new set, or adjust the settings above." />
            </div>
          )}

          <ol className="mt-4 flex flex-col gap-4">
            {candidates.map((candidate, index) => (
              <li key={candidate.tempId}>
                <QuestionCard
                  candidate={candidate}
                  index={index}
                  taxonomy={result.taxonomy}
                  organizationName={result.organizationName}
                  checked={selected.has(candidate.tempId)}
                  selectable={candidate.status === "new"}
                  editing={editingId === candidate.tempId}
                  draft={editingId === candidate.tempId ? draft : null}
                  onToggle={() => toggle(candidate.tempId)}
                  onEdit={() => startEdit(candidate)}
                  onRemove={() => removeCard(candidate.tempId)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onPatchDraft={patchDraft}
                />
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}

/* ============================ Presentational ============================ */

function Header() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Bot className="h-6 w-6 text-brand-600" />
          AI Generated Questions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Draft questions with AI, check them against your Question Bank, then import the ones you want.
        </p>
      </div>
    </header>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      {icon}
      {title}
    </h2>
  );
}

interface CardProps {
  candidate: Candidate;
  index: number;
  taxonomy: GenerateResult["taxonomy"];
  organizationName: string;
  checked: boolean;
  selectable: boolean;
  editing: boolean;
  draft: NormalisedQuestion | null;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onPatchDraft: (patch: Partial<NormalisedQuestion>) => void;
}

function QuestionCard(props: CardProps) {
  const { candidate, index, taxonomy, organizationName, checked, selectable, editing, draft } = props;
  const question = candidate.question;

  const statusBadge =
    candidate.status === "new" ? (
      <Badge tone="green">
        <Check className="mr-1 inline h-3 w-3" />
        New
      </Badge>
    ) : candidate.status === "duplicate" ? (
      <Badge tone="amber">Duplicate</Badge>
    ) : (
      <Badge tone="red">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        Needs Review
      </Badge>
    );

  return (
    <div
      className={`rounded-xl border p-4 ${
        candidate.status === "new" ? "border-slate-200" : "border-amber-200 bg-amber-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={checked}
            disabled={!selectable}
            onChange={props.onToggle}
            aria-label={`Select question ${index + 1}`}
          />
          Question {index + 1}
        </label>
        {statusBadge}
      </div>

      {editing && draft ? (
        <EditForm draft={draft} onPatch={props.onPatchDraft} onCancel={props.onCancelEdit} onSave={props.onSaveEdit} />
      ) : (
        <>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{question.question.text}</p>

          {question.options.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
              {question.options.map((option) => {
                const correct = question.answer.correctOptions.includes(option.id);
                return (
                  <li key={option.id} className={correct ? "font-semibold text-emerald-700" : ""}>
                    ({option.id}) {option.text}
                    {correct ? <Check className="ml-1 inline h-3 w-3" /> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {question.type === "TRUE_FALSE" ? (
            <p className="mt-3 text-sm text-slate-700">
              Answer: <span className="font-semibold text-emerald-700">{question.answer.booleanAnswer ? "True" : "False"}</span>
            </p>
          ) : null}

          {question.answer.text && question.options.length === 0 && question.type !== "TRUE_FALSE" ? (
            <p className="mt-3 text-sm text-slate-700">
              Answer: <span className="font-semibold text-emerald-700">{question.answer.text}</span>
            </p>
          ) : null}

          {question.explanation ? (
            <p className="mt-2 text-xs text-slate-500">{question.explanation}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {TYPE_LABELS[question.type]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {question.difficulty ? DIFFICULTY_LABELS[question.difficulty] : "Unset"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {question.marks} mark(s)
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {taxonomy.categoryName} · {taxonomy.subjectName} · {taxonomy.chapterName}
              {taxonomy.topicName ? ` · ${taxonomy.topicName}` : ""}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              <Bot className="mr-1 inline h-3 w-3" />
              AI Generated
            </Badge>
            <Badge tone="slate">
              <Tag className="mr-1 inline h-3 w-3" />
              {organizationName}
            </Badge>
          </div>

          {candidate.status === "needs_review" && candidate.issues.length > 0 ? (
            <div className="mt-3">
              <Alert tone="error">
                <ul className="list-disc pl-5">
                  {candidate.issues.map((issue, issueIndex) => (
                    <li key={issueIndex}>{issue}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}

          {candidate.status === "duplicate" ? (
            <div className="mt-3">
              <Alert tone="info">
                This question already exists in your Question Bank.{" "}
                {candidate.duplicateOf ? (
                  <Link
                    className="font-medium underline"
                    href={`/dashboard/questions/${candidate.duplicateOf}/edit`}
                  >
                    View Existing <ExternalLink className="inline h-3 w-3" />
                  </Link>
                ) : null}
              </Alert>
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={props.onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="ghost" onClick={props.onRemove}>
              <Trash className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface EditFormProps {
  draft: NormalisedQuestion;
  onPatch: (patch: Partial<NormalisedQuestion>) => void;
  onCancel: () => void;
  onSave: () => void;
}

function EditForm({ draft, onPatch, onCancel, onSave }: EditFormProps) {
  const usesOptions = draft.type === "MCQ" || draft.type === "MULTIPLE_CORRECT";
  const single = draft.type === "MCQ";

  function setOptionText(optionIndex: number, text: string) {
    const options = draft.options.map((option, i) => (i === optionIndex ? { ...option, text } : option));
    onPatch({ options });
  }

  function toggleCorrect(optionId: string) {
    const current = draft.answer.correctOptions;
    const next = single
      ? [optionId]
      : current.includes(optionId)
        ? current.filter((value) => value !== optionId)
        : [...current, optionId];
    onPatch({ answer: { ...draft.answer, correctOptions: next } });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-card p-3">
      <Field label="Question text" required>
        {({ id }) => (
          <textarea
            id={id}
            rows={3}
            value={draft.question.text}
            onChange={(event) => onPatch({ question: { text: event.target.value } })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        )}
      </Field>

      {usesOptions ? (
        <div className="flex flex-col gap-2">
          {draft.options.map((option, optionIndex) => (
            <div key={option.id} className="flex items-center gap-2">
              <label className="flex w-14 items-center gap-1 text-sm font-medium text-slate-700">
                <input
                  type={single ? "radio" : "checkbox"}
                  name="ai-edit-correct"
                  checked={draft.answer.correctOptions.includes(option.id)}
                  onChange={() => toggleCorrect(option.id)}
                  aria-label={`Mark option ${option.id} correct`}
                />
                {option.id}
              </label>
              <TextInput
                value={option.text}
                placeholder={`Option ${OPTION_LETTERS[optionIndex] ?? option.id}`}
                onChange={(event) => setOptionText(optionIndex, event.target.value)}
              />
            </div>
          ))}
        </div>
      ) : null}

      {draft.type === "TRUE_FALSE" ? (
        <Field label="Correct answer" required>
          {({ id }) => (
            <Select
              id={id}
              value={draft.answer.booleanAnswer === null ? "" : draft.answer.booleanAnswer ? "true" : "false"}
              onChange={(event) =>
                onPatch({
                  answer: {
                    ...draft.answer,
                    booleanAnswer: event.target.value === "" ? null : event.target.value === "true",
                  },
                })
              }
            >
              <option value="">Select…</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </Select>
          )}
        </Field>
      ) : null}

      {!usesOptions && draft.type !== "TRUE_FALSE" ? (
        <Field label="Expected answer" required>
          {({ id }) => (
            <textarea
              id={id}
              rows={2}
              value={draft.answer.text}
              onChange={(event) => onPatch({ answer: { ...draft.answer, text: event.target.value } })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          )}
        </Field>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Difficulty">
          {({ id }) => (
            <Select
              id={id}
              value={draft.difficulty ?? ""}
              onChange={(event) =>
                onPatch({ difficulty: (event.target.value || null) as Difficulty | null })
              }
            >
              <option value="">Unset</option>
              {DIFFICULTIES.map((value) => (
                <option key={value} value={value}>
                  {DIFFICULTY_LABELS[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Explanation">
        {({ id }) => (
          <textarea
            id={id}
            rows={2}
            value={draft.explanation}
            onChange={(event) => onPatch({ explanation: event.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        )}
      </Field>

      <div className="flex gap-2">
        <Button onClick={onSave}>
          <Check className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
