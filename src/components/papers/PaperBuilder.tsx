"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Button, Card, Field, Select, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { DIFFICULTIES, QUESTION_TYPES } from "@/types/question";

/**
 * Quick paper creation.
 *
 * Deliberately minimal: title, category, subject, chapters, one type and one
 * difficulty. A fixed-size (10 question) paper is generated immediately and
 * the teacher lands on the paper's own page, where the full blueprint
 * (board, exam, language, exact quotas, question count) can be tuned and
 * regenerated. Splitting it this way keeps the entry point simple without
 * losing any of the generator's capability.
 */

const DEFAULT_TOTAL_QUESTIONS = 10;

interface TaxonomyOption {
  _id: string;
  name: string;
}

export default function PaperBuilder() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const result = await apiFetch<TaxonomyOption[]>("/api/categories?limit=100");
      if (result.success) setCategories(result.data);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!category) {
      setSubjects([]);
      return;
    }
    async function load() {
      const result = await apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${category}`);
      setSubjects(result.success ? result.data : []);
    }
    void load();
  }, [category]);

  useEffect(() => {
    if (!subject) {
      setChapters([]);
      setSelectedChapters([]);
      return;
    }
    async function load() {
      const result = await apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subject}`);
      setChapters(result.success ? result.data : []);
    }
    void load();
  }, [subject]);

  async function generate() {
    setBusy(true);
    setError("");
    setErrors({});

    const result = await apiFetch<{ paper: { _id: string } }>("/api/papers/generate", {
      method: "POST",
      json: {
        title,
        instructions: "",
        durationMinutes: null,
        spec: {
          category,
          subject,
          chapters: selectedChapters,
          topics: [],
          board: null,
          exam: null,
          year: null,
          language: null,
          totalQuestions: DEFAULT_TOTAL_QUESTIONS,
          totalMarks: null,
          difficultyDistribution: difficulty
            ? [{ difficulty, count: DEFAULT_TOTAL_QUESTIONS }]
            : [],
          typeDistribution: type ? [{ type, count: DEFAULT_TOTAL_QUESTIONS }] : [],
          status: "APPROVED",
        },
      },
    });

    setBusy(false);

    if (!result.success) {
      setErrors(fieldErrors(result));
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success("Question paper generated successfully!");
    router.push(`/dashboard/papers/${result.data.paper._id}`);
  }

  const canGenerate = title.trim() && category && subject && selectedChapters.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">New question paper</h1>
        <p className="mt-1 text-sm text-slate-500">
          A 10-question paper is generated right away. Fine-tune it — board, exam,
          language, exact quotas, question count — from the paper's page.
        </p>
      </header>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Paper details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" required>
            {({ id }) => (
              <TextInput id={id} value={title} onChange={(event) => setTitle(event.target.value)} required />
            )}
          </Field>
          <Field label="Category" error={errors.category} required>
            {({ id }) => (
              <Select id={id} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Select…</option>
                {categories.map((option) => (
                  <option key={option._id} value={option._id}>{option.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Subject" error={errors.subject} required>
            {({ id }) => (
              <Select id={id} value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="">Select…</option>
                {subjects.map((option) => (
                  <option key={option._id} value={option._id}>{option.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Type" hint="Optional — leave blank for a mix.">
            {({ id }) => (
              <Select id={id} value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">Any</option>
                {QUESTION_TYPES.map((value) => (
                  <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Difficulty" hint="Optional — leave blank for a mix.">
            {({ id }) => (
              <Select id={id} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="">Any</option>
                {DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-slate-700">Chapters</p>
          {chapters.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Select a subject to list its chapters.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
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
                    className={`rounded-lg px-3 py-1.5 text-sm ${
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
          )}
          {errors.chapters ? <p className="mt-2 text-xs text-red-600">{errors.chapters}</p> : null}
        </div>

        <div className="mt-6">
          <Button loading={busy} disabled={!canGenerate} onClick={generate}>
            Generate paper
          </Button>
        </div>
      </Card>
    </div>
  );
}
