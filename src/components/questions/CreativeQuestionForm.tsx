"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, Select, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { DIFFICULTIES, QUESTION_STATUSES } from "@/types/question";

interface TaxonomyOption {
  _id: string;
  name: string;
}

interface CQPart {
  text: string;
  answer: string;
}

export interface CreativeQuestionFormValues {
  category: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  status: string;
  instruction: string;
  stimulus: string;
  parts: [CQPart, CQPart, CQPart, CQPart];
}

const PART_LABELS = [
  { bn: "ক", en: "A", marks: 1, desc: "জ্ঞানমূলক (Knowledge-based)" },
  { bn: "খ", en: "B", marks: 2, desc: "অনুধাবনমূলক (Comprehension-based)" },
  { bn: "গ", en: "C", marks: 3, desc: "প্রয়োগমূলক (Application-based)" },
  { bn: "ঘ", en: "D", marks: 4, desc: "উচ্চতর দক্ষতামূলক (Higher order)" },
] as const;

const EMPTY_VALUES: CreativeQuestionFormValues = {
  category: "",
  subject: "",
  chapter: "",
  topic: "",
  difficulty: "",
  status: "DRAFT",
  instruction: "",
  stimulus: "",
  parts: [
    { text: "", answer: "" },
    { text: "", answer: "" },
    { text: "", answer: "" },
    { text: "", answer: "" },
  ],
};

interface Props {
  canReview: boolean;
}

export default function CreativeQuestionForm({ canReview }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = useState<CreativeQuestionFormValues>(EMPTY_VALUES);
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = useState<TaxonomyOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof CreativeQuestionFormValues>(key: K, value: CreativeQuestionFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [String(key)]: "" }));
  }, []);

  const setPartText = useCallback((index: 0 | 1 | 2 | 3, text: string) => {
    setValues((prev) => {
      const nextParts = [...prev.parts] as [CQPart, CQPart, CQPart, CQPart];
      nextParts[index] = { ...nextParts[index], text };
      return { ...prev, parts: nextParts };
    });
    setErrors((prev) => ({ ...prev, [`questions.${index}.text`]: "" }));
  }, []);

  const setPartAnswer = useCallback((index: 0 | 1 | 2 | 3, answer: string) => {
    setValues((prev) => {
      const nextParts = [...prev.parts] as [CQPart, CQPart, CQPart, CQPart];
      nextParts[index] = { ...nextParts[index], answer };
      return { ...prev, parts: nextParts };
    });
    setErrors((prev) => ({ ...prev, [`questions.${index}.answer`]: "" }));
  }, []);

  /* --------------------------- Taxonomy loading --------------------------- */

  useEffect(() => {
    async function load() {
      const res = await apiFetch<TaxonomyOption[]>("/api/categories?limit=100");
      if (res.success) setCategories(res.data);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!values.category) {
      queueMicrotask(() => setSubjects([]));
      return;
    }
    async function load() {
      const res = await apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${values.category}`);
      setSubjects(res.success ? res.data : []);
    }
    void load();
  }, [values.category]);

  useEffect(() => {
    if (!values.subject) {
      queueMicrotask(() => setChapters([]));
      return;
    }
    async function load() {
      const res = await apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${values.subject}`);
      setChapters(res.success ? res.data : []);
    }
    void load();
  }, [values.subject]);

  useEffect(() => {
    if (!values.chapter) {
      queueMicrotask(() => setTopics([]));
      return;
    }
    async function load() {
      const res = await apiFetch<TaxonomyOption[]>(`/api/topics?limit=100&chapter=${values.chapter}`);
      setTopics(res.success ? res.data : []);
    }
    void load();
  }, [values.chapter]);

  /* ------------------------------ Validation ----------------------------- */

  const localIssues = useMemo(() => {
    const issues: string[] = [];
    if (!values.category) issues.push("Select a category.");
    if (!values.subject) issues.push("Select a subject.");
    if (!values.chapter) issues.push("Select a chapter.");
    if (!values.stimulus.trim()) issues.push("Stimulus (উদ্দীপক) is required.");
    PART_LABELS.forEach((p, idx) => {
      if (!values.parts[idx].text.trim()) {
        issues.push(`Question part ${p.bn} (${p.marks} mark) is required.`);
      }
      if (!values.parts[idx].answer.trim()) {
        issues.push(`Answer for part ${p.bn} is required.`);
      }
    });
    return issues;
  }, [values]);

  /* -------------------------------- Submit -------------------------------- */

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setGeneralError("");

    if (localIssues.length > 0) {
      setGeneralError(localIssues[0]);
      return;
    }

    setSaving(true);

    const payload = {
      category: values.category,
      subject: values.subject,
      chapter: values.chapter,
      topic: values.topic || null,
      difficulty: values.difficulty || null,
      status: values.status || "DRAFT",
      instruction: values.instruction.trim(),
      stimulus: values.stimulus.trim(),
      questions: values.parts.map((part, index) => ({
        text: part.text.trim(),
        answer: part.answer.trim(),
        marks: (index + 1) as 1 | 2 | 3 | 4,
        order: index as 0 | 1 | 2 | 3,
      })),
    };

    const res = await apiFetch<{ _id: string }>("/api/creative-questions", {
      method: "POST",
      json: payload,
    });

    setSaving(false);

    if (!res.success) {
      setErrors(fieldErrors(res));
      setGeneralError(res.error.message);
      toast.error(res.error.message);
      return;
    }

    toast.success("Creative question created successfully.");
    router.push("/dashboard/questions");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {generalError ? <Alert tone="error">{generalError}</Alert> : null}

      {/* 1. Placement context */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Placement &amp; Taxonomy</h2>
            <p className="text-xs text-slate-500">Context and organization scope for this creative question.</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            10 Marks (1 + 2 + 3 + 4)
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Category" required error={errors.category}>
            {({ id }) => (
              <Select
                id={id}
                value={values.category}
                onChange={(e) => {
                  set("category", e.target.value);
                  set("subject", "");
                  set("chapter", "");
                  set("topic", "");
                }}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Subject" required error={errors.subject}>
            {({ id }) => (
              <Select
                id={id}
                value={values.subject}
                disabled={!values.category}
                onChange={(e) => {
                  set("subject", e.target.value);
                  set("chapter", "");
                  set("topic", "");
                }}
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Chapter" required error={errors.chapter}>
            {({ id }) => (
              <Select
                id={id}
                value={values.chapter}
                disabled={!values.subject}
                onChange={(e) => {
                  set("chapter", e.target.value);
                  set("topic", "");
                }}
              >
                <option value="">Select chapter</option>
                {chapters.map((ch) => (
                  <option key={ch._id} value={ch._id}>
                    {ch.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Topic (optional)" error={errors.topic}>
            {({ id }) => (
              <Select
                id={id}
                value={values.topic}
                disabled={!values.chapter}
                onChange={(e) => set("topic", e.target.value)}
              >
                <option value="">Select topic</option>
                {topics.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Difficulty" error={errors.difficulty}>
            {({ id }) => (
              <Select
                id={id}
                value={values.difficulty}
                onChange={(e) => set("difficulty", e.target.value)}
              >
                <option value="">None specified</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Status" error={errors.status}>
            {({ id }) => (
              <Select id={id} value={values.status} onChange={(e) => set("status", e.target.value)}>
                {QUESTION_STATUSES.map((s) => {
                  if (s === "APPROVED" && !canReview) return null;
                  return (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  );
                })}
              </Select>
            )}
          </Field>

          <div className="sm:col-span-2">
            <Field label="Additional Instruction (optional)" error={errors.instruction}>
              {({ id }) => (
                <TextInput
                  id={id}
                  value={values.instruction}
                  placeholder="e.g. নিচের উদ্দীপকটি পড়ে প্রশ্নগুলোর উত্তর দাও:"
                  onChange={(e) => set("instruction", e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>
      </Card>

      {/* 2. Stimulus / উদ্দীপক */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Stimulus / উদ্দীপক</h2>
            <p className="text-xs text-slate-500">Provide the scenario, passage, data, or context for the creative question.</p>
          </div>
        </div>

        <div className="mt-4">
          <Field label="Stimulus Text" required error={errors.stimulus}>
            {({ id }) => (
              <textarea
                id={id}
                rows={5}
                value={values.stimulus}
                placeholder="Write or paste the stimulus / উদ্দীপক content here..."
                onChange={(e) => set("stimulus", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
          </Field>
        </div>
      </Card>

      {/* 3. ক, খ, গ, ঘ Sub-questions and Answers */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Questions (ক, খ, গ, ঘ) &amp; Answers</h2>
            <p className="text-xs text-slate-500">
              Four structured parts totaling 10 marks. Enter questions and their model answers for teachers.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600">Total: 10 Marks</span>
        </div>

        <div className="mt-5 space-y-6">
          {PART_LABELS.map((part, index) => {
            const idx = index as 0 | 1 | 2 | 3;
            const currentPart = values.parts[idx];
            return (
              <div key={part.bn} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {part.bn}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      প্রশ্ন ({part.bn}) — {part.desc}
                    </span>
                  </div>
                  <span className="rounded bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {part.marks} {part.marks === 1 ? "Mark" : "Marks"}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  <Field label={`Question (${part.bn})`} required error={errors[`questions.${idx}.text`]}>
                    {({ id }) => (
                      <TextInput
                        id={id}
                        value={currentPart.text}
                        placeholder={`Enter question ${part.bn}...`}
                        onChange={(e) => setPartText(idx, e.target.value)}
                      />
                    )}
                  </Field>

                  <Field label={`Model Answer (${part.bn})`} required error={errors[`questions.${idx}.answer`]}>
                    {({ id }) => (
                      <textarea
                        id={id}
                        rows={3}
                        value={currentPart.answer}
                        placeholder={`Enter model answer for part ${part.bn} (available for teacher copy and answer key)...`}
                        onChange={(e) => setPartAnswer(idx, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    )}
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => router.push("/dashboard/questions")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving CQ..." : "Create Creative Question"}
        </Button>
      </div>
    </form>
  );
}
