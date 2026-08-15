"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, Select, TextInput } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import QuestionPreview from "@/components/questions/QuestionPreview";
import {
  DIFFICULTIES,
  LANGUAGES,
  OPTION_BASED_TYPES,
  QUESTION_TYPES,
  type QuestionType,
} from "@/types/question";

/**
 * Create/edit form covering all ten question types.
 *
 * The visible answer controls switch on the selected type, mirroring
 * `validateAnswerForType` in the service. The client shape-check is a
 * convenience only — the server remains the authority and its field-level
 * errors are mapped straight back onto the inputs.
 */

interface TaxonomyOption {
  _id: string;
  name: string;
}

export interface QuestionFormValues {
  category: string;
  subject: string;
  chapter: string;
  topic: string;
  board: string;
  exam: string;
  type: QuestionType;
  difficulty: string;
  language: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptions: string[];
  answerText: string;
  booleanAnswer: "" | "true" | "false";
  matchingPairs: { left: string; right: string }[];
  explanation: string;
  marks: string;
  year: string;
  source: string;
  tags: string;
  status: string;
}

const EMPTY: QuestionFormValues = {
  category: "",
  subject: "",
  chapter: "",
  topic: "",
  board: "",
  exam: "",
  type: "MCQ",
  difficulty: "",
  language: "bn",
  text: "",
  options: [
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ],
  correctOptions: [],
  answerText: "",
  booleanAnswer: "",
  matchingPairs: [
    { left: "", right: "" },
    { left: "", right: "" },
  ],
  explanation: "",
  marks: "1",
  year: "",
  source: "",
  tags: "",
  status: "DRAFT",
};

export function toPayload(values: QuestionFormValues): Record<string, unknown> {
  const usesOptions = OPTION_BASED_TYPES.includes(values.type);

  return {
    category: values.category,
    subject: values.subject,
    chapter: values.chapter,
    topic: values.topic || null,
    board: values.board || null,
    exam: values.exam || null,
    type: values.type,
    difficulty: values.difficulty || null,
    language: values.language,
    question: { text: values.text },
    // Types that do not take options must send none: the service rejects extras.
    options: usesOptions ? values.options.filter((option) => option.text.trim()) : [],
    answer: {
      text: values.answerText,
      correctOptions: usesOptions ? values.correctOptions : [],
      booleanAnswer:
        values.type === "TRUE_FALSE" && values.booleanAnswer !== ""
          ? values.booleanAnswer === "true"
          : null,
      matchingPairs:
        values.type === "MATCHING"
          ? values.matchingPairs.filter((pair) => pair.left.trim() && pair.right.trim())
          : [],
    },
    explanation: values.explanation,
    marks: Number(values.marks) || 1,
    year: values.year ? Number(values.year) : null,
    source: values.source,
    tags: values.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    status: values.status,
  };
}

interface Props {
  mode: "create" | "edit";
  questionId?: string;
  initialValues?: Partial<QuestionFormValues>;
  canReview: boolean;
}

export default function QuestionForm({ mode, questionId, initialValues, canReview }: Props) {
  const router = useRouter();

  const [values, setValues] = useState<QuestionFormValues>({ ...EMPTY, ...initialValues });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = useState<TaxonomyOption[]>([]);
  const [boards, setBoards] = useState<TaxonomyOption[]>([]);
  const [exams, setExams] = useState<TaxonomyOption[]>([]);

  const usesOptions = OPTION_BASED_TYPES.includes(values.type);
  const singleAnswer = values.type === "MCQ" || values.type === "ASSERTION_REASON";

  const set = useCallback(<K extends keyof QuestionFormValues>(key: K, value: QuestionFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [String(key)]: "" }));
  }, []);

  /* --------------------------- Taxonomy loading --------------------------- */

  useEffect(() => {
    async function load() {
      const [categoryResult, boardResult, examResult] = await Promise.all([
        apiFetch<TaxonomyOption[]>("/api/categories?limit=100"),
        apiFetch<TaxonomyOption[]>("/api/boards?limit=100"),
        apiFetch<TaxonomyOption[]>("/api/exams?limit=100"),
      ]);

      if (categoryResult.success) setCategories(categoryResult.data);
      if (boardResult.success) setBoards(boardResult.data);
      if (examResult.success) setExams(examResult.data);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!values.category) {
      setSubjects([]);
      return;
    }
    async function load() {
      const result = await apiFetch<TaxonomyOption[]>(
        `/api/subjects?limit=100&category=${values.category}`,
      );
      setSubjects(result.success ? result.data : []);
    }
    void load();
  }, [values.category]);

  useEffect(() => {
    if (!values.subject) {
      setChapters([]);
      return;
    }
    async function load() {
      const result = await apiFetch<TaxonomyOption[]>(
        `/api/chapters?limit=100&subject=${values.subject}`,
      );
      setChapters(result.success ? result.data : []);
    }
    void load();
  }, [values.subject]);

  useEffect(() => {
    if (!values.chapter) {
      setTopics([]);
      return;
    }
    async function load() {
      const result = await apiFetch<TaxonomyOption[]>(
        `/api/topics?limit=100&chapter=${values.chapter}`,
      );
      setTopics(result.success ? result.data : []);
    }
    void load();
  }, [values.chapter]);

  /* ------------------------------ Local check ----------------------------- */

  const localIssues = useMemo(() => {
    const issues: string[] = [];
    if (!values.text.trim()) issues.push("Question text is required.");
    if (!values.chapter) issues.push("Select a chapter.");

    if (usesOptions) {
      const filled = values.options.filter((option) => option.text.trim());
      if (filled.length < 2) issues.push("Provide at least two options.");
      if (singleAnswer && values.correctOptions.length !== 1) {
        issues.push("Mark exactly one option as correct.");
      }
      if (values.type === "MULTIPLE_CORRECT" && values.correctOptions.length < 2) {
        issues.push("Mark at least two options as correct.");
      }
    }

    if (values.type === "TRUE_FALSE" && values.booleanAnswer === "") {
      issues.push("Choose true or false.");
    }

    if (values.type === "MATCHING") {
      const pairs = values.matchingPairs.filter((pair) => pair.left.trim() && pair.right.trim());
      if (pairs.length < 2) issues.push("Provide at least two matching pairs.");
    }

    if (
      ["SHORT", "WRITTEN", "FILL_BLANK", "IMAGE", "PASSAGE"].includes(values.type) &&
      !values.answerText.trim()
    ) {
      issues.push("Provide the expected answer.");
    }

    return issues;
  }, [values, usesOptions, singleAnswer]);

  /* -------------------------------- Submit -------------------------------- */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setSuccess("");

    if (localIssues.length > 0) {
      setMessage(localIssues[0] ?? "Please complete the form.");
      return;
    }

    setSaving(true);

    const result =
      mode === "create"
        ? await apiFetch<{ _id: string }>("/api/questions", {
            method: "POST",
            json: toPayload(values),
          })
        : await apiFetch<{ _id: string }>(`/api/questions/${questionId}`, {
            method: "PUT",
            json: toPayload(values),
          });

    setSaving(false);

    if (!result.success) {
      const mapped = fieldErrors(result);
      // Server paths are dotted (answer.correctOptions); surface them readably.
      setErrors({
        text: mapped["question.text"] ?? "",
        chapter: mapped.chapter ?? "",
        subject: mapped.subject ?? "",
        category: mapped.category ?? "",
        topic: mapped.topic ?? "",
        options: mapped.options ?? "",
        correctOptions: mapped["answer.correctOptions"] ?? "",
        answerText: mapped["answer.text"] ?? "",
        booleanAnswer: mapped["answer.booleanAnswer"] ?? "",
        matchingPairs: mapped["answer.matchingPairs"] ?? "",
        status: mapped.status ?? "",
      });
      setMessage(result.error.message);
      return;
    }

    setSuccess(mode === "create" ? "Question created." : "Question updated.");

    if (mode === "create") {
      setTimeout(() => router.push("/dashboard/questions"), 700);
    } else {
      router.refresh();
    }
  }

  /* --------------------------------- View --------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === "create" ? "New question" : "Edit question"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Answer fields change with the question type. All rules are re-checked on the server.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowPreview((previous) => !previous)}>
          {showPreview ? "Hide preview" : "Preview"}
        </Button>
      </header>

      {showPreview ? (
        <QuestionPreview values={values} />
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {message ? <Alert tone="error">{message}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Placement</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Category" error={errors.category} required>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={values.category}
                  onChange={(event) => {
                    set("category", event.target.value);
                    set("subject", "");
                    set("chapter", "");
                    set("topic", "");
                  }}
                  required
                >
                  <option value="">Select…</option>
                  {categories.map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Subject" error={errors.subject} required>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={values.subject}
                  onChange={(event) => {
                    set("subject", event.target.value);
                    set("chapter", "");
                    set("topic", "");
                  }}
                  required
                >
                  <option value="">Select…</option>
                  {subjects.map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Chapter" error={errors.chapter} required>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={values.chapter}
                  onChange={(event) => {
                    set("chapter", event.target.value);
                    set("topic", "");
                  }}
                  required
                >
                  <option value="">Select…</option>
                  {chapters.map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Topic" error={errors.topic}>
              {({ id }) => (
                <Select id={id} value={values.topic} onChange={(event) => set("topic", event.target.value)}>
                  <option value="">None</option>
                  {topics.map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Board">
              {({ id }) => (
                <Select id={id} value={values.board} onChange={(event) => set("board", event.target.value)}>
                  <option value="">None</option>
                  {boards.map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Exam">
              {({ id }) => (
                <Select id={id} value={values.exam} onChange={(event) => set("exam", event.target.value)}>
                  <option value="">None</option>
                  {exams.map((option) => (
                    <option key={option._id} value={option._id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Question</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type" required>
              {({ id }) => (
                <Select
                  id={id}
                  value={values.type}
                  onChange={(event) => {
                    set("type", event.target.value as QuestionType);
                    set("correctOptions", []);
                  }}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Difficulty">
              {({ id }) => (
                <Select
                  id={id}
                  value={values.difficulty}
                  onChange={(event) => set("difficulty", event.target.value)}
                >
                  <option value="">Unset</option>
                  {DIFFICULTIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Language">
              {({ id }) => (
                <Select
                  id={id}
                  value={values.language}
                  onChange={(event) => set("language", event.target.value)}
                >
                  {LANGUAGES.map((value) => (
                    <option key={value} value={value}>
                      {value === "bn" ? "Bangla" : "English"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Marks">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  step="0.5"
                  value={values.marks}
                  onChange={(event) => set("marks", event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Question text" error={errors.text} required>
              {({ id, invalid }) => (
                <textarea
                  id={id}
                  aria-invalid={invalid || undefined}
                  rows={4}
                  value={values.text}
                  onChange={(event) => set("text", event.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${
                    invalid ? "border-red-400" : "border-slate-300"
                  }`}
                  required
                />
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Answer</h2>

          {usesOptions ? (
            <div className="mt-4 flex flex-col gap-3">
              {errors.options ? <Alert tone="error">{errors.options}</Alert> : null}
              {errors.correctOptions ? <Alert tone="error">{errors.correctOptions}</Alert> : null}

              {values.options.map((option, index) => {
                const checked = values.correctOptions.includes(option.id);
                return (
                  <div key={option.id} className="flex items-center gap-3">
                    <label className="flex w-16 items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type={singleAnswer ? "radio" : "checkbox"}
                        name="correctOption"
                        checked={checked}
                        onChange={() => {
                          if (singleAnswer) {
                            set("correctOptions", [option.id]);
                          } else {
                            set(
                              "correctOptions",
                              checked
                                ? values.correctOptions.filter((value) => value !== option.id)
                                : [...values.correctOptions, option.id],
                            );
                          }
                        }}
                        aria-label={`Mark option ${option.id} correct`}
                      />
                      {option.id}
                    </label>
                    <TextInput
                      value={option.text}
                      placeholder={`Option ${option.id}`}
                      onChange={(event) => {
                        const next = [...values.options];
                        next[index] = { ...option, text: event.target.value };
                        set("options", next);
                      }}
                    />
                  </div>
                );
              })}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={values.options.length >= 8}
                  onClick={() =>
                    set("options", [
                      ...values.options,
                      { id: String.fromCharCode(65 + values.options.length), text: "" },
                    ])
                  }
                >
                  Add option
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={values.options.length <= 2}
                  onClick={() => {
                    const removed = values.options[values.options.length - 1];
                    set("options", values.options.slice(0, -1));
                    if (removed) {
                      set(
                        "correctOptions",
                        values.correctOptions.filter((value) => value !== removed.id),
                      );
                    }
                  }}
                >
                  Remove last
                </Button>
              </div>
            </div>
          ) : null}

          {values.type === "TRUE_FALSE" ? (
            <div className="mt-4">
              <Field label="Correct answer" error={errors.booleanAnswer} required>
                {({ id }) => (
                  <Select
                    id={id}
                    value={values.booleanAnswer}
                    onChange={(event) =>
                      set("booleanAnswer", event.target.value as QuestionFormValues["booleanAnswer"])
                    }
                  >
                    <option value="">Select…</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </Select>
                )}
              </Field>
            </div>
          ) : null}

          {values.type === "MATCHING" ? (
            <div className="mt-4 flex flex-col gap-3">
              {errors.matchingPairs ? <Alert tone="error">{errors.matchingPairs}</Alert> : null}
              {values.matchingPairs.map((pair, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  <TextInput
                    value={pair.left}
                    placeholder="Left"
                    aria-label={`Pair ${index + 1} left`}
                    onChange={(event) => {
                      const next = [...values.matchingPairs];
                      next[index] = { ...pair, left: event.target.value };
                      set("matchingPairs", next);
                    }}
                  />
                  <TextInput
                    value={pair.right}
                    placeholder="Right"
                    aria-label={`Pair ${index + 1} right`}
                    onChange={(event) => {
                      const next = [...values.matchingPairs];
                      next[index] = { ...pair, right: event.target.value };
                      set("matchingPairs", next);
                    }}
                  />
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={values.matchingPairs.length >= 10}
                  onClick={() => set("matchingPairs", [...values.matchingPairs, { left: "", right: "" }])}
                >
                  Add pair
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <Field
              label={usesOptions ? "Answer note (optional)" : "Expected answer"}
              error={errors.answerText}
              required={!usesOptions && values.type !== "TRUE_FALSE" && values.type !== "MATCHING"}
            >
              {({ id, invalid }) => (
                <textarea
                  id={id}
                  aria-invalid={invalid || undefined}
                  rows={3}
                  value={values.answerText}
                  onChange={(event) => set("answerText", event.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${
                    invalid ? "border-red-400" : "border-slate-300"
                  }`}
                />
              )}
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Explanation (shown only to staff)">
              {({ id }) => (
                <textarea
                  id={id}
                  rows={3}
                  value={values.explanation}
                  onChange={(event) => set("explanation", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Metadata</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Year">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="number"
                  value={values.year}
                  onChange={(event) => set("year", event.target.value)}
                />
              )}
            </Field>
            <Field label="Source">
              {({ id }) => (
                <TextInput id={id} value={values.source} onChange={(event) => set("source", event.target.value)} />
              )}
            </Field>
            <Field label="Tags" hint="Comma separated.">
              {({ id }) => (
                <TextInput id={id} value={values.tags} onChange={(event) => set("tags", event.target.value)} />
              )}
            </Field>
            <Field label="Status" error={errors.status}>
              {({ id, invalid }) => (
                <Select
                  id={id}
                  invalid={invalid}
                  value={values.status}
                  onChange={(event) => set("status", event.target.value)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING">Submit for review</option>
                  {/* Approve/reject require question:review and are refused server-side otherwise. */}
                  {canReview ? <option value="APPROVED">Approved</option> : null}
                  {canReview ? <option value="REJECTED">Rejected</option> : null}
                </Select>
              )}
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving}>
            {mode === "create" ? "Create question" : "Save changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/dashboard/questions")}>
            Cancel
          </Button>
        </div>

        {localIssues.length > 0 ? (
          <p className="text-xs text-slate-500">
            {localIssues.length} item(s) still to complete: {localIssues.join(" ")}
          </p>
        ) : null}
      </form>
    </div>
  );
}
