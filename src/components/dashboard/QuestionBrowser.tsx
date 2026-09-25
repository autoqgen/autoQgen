"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Pagination,
  Select,
  Spinner,
  TextInput,
} from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { DIFFICULTIES, QUESTION_TYPES } from "@/types/question";
import type { PaginationMeta } from "@/types/api";

interface BrowserQuestion {
  _id: string;
  question: { text: string };
  type: string;
  difficulty: string | null;
  status: string;
  marks: number;
  tags: string[];
  answersIncluded: boolean;
  answer?: { text: string; correctOptions: string[]; booleanAnswer: boolean | null };
}

interface BrowserCreativeQuestion {
  _id: string;
  category?: { name: string };
  subject?: { name: string };
  chapter?: { name: string };
  topic?: { name: string };
  difficulty: string | null;
  status: string;
  totalMarks: number;
  instruction: string;
  stimulus: string;
  questions: {
    text: string;
    answer?: string;
    marks: number;
    order: number;
  }[];
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "green",
  PENDING: "amber",
  DRAFT: "slate",
  REJECTED: "red",
};

const PART_LABELS = ["ক", "খ", "গ", "ঘ"];

export default function QuestionBrowser({ canReadAnswers }: { canReadAnswers: boolean }) {
  const [activeTab, setActiveTab] = useState<"standard" | "creative">("standard");

  // Standard questions state
  const [items, setItems] = useState<BrowserQuestion[]>([]);
  // Creative questions state
  const [creativeItems, setCreativeItems] = useState<BrowserCreativeQuestion[]>([]);

  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [mine, setMine] = useState(false);
  const [withAnswers, setWithAnswers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (difficulty) params.set("difficulty", difficulty);
    if (mine) params.set("mine", "true");
    if (withAnswers && canReadAnswers) params.set("withAnswers", "true");

    if (activeTab === "standard") {
      if (type && type !== "CQ") params.set("type", type);
      const result = await apiFetch<BrowserQuestion[]>(`/api/questions?${params.toString()}`);
      setLoading(false);

      if (!result.success) {
        setError(result.error.message);
        setItems([]);
        return;
      }

      setItems(result.data);
      setMeta(result.meta ?? null);
    } else {
      const result = await apiFetch<BrowserCreativeQuestion[]>(`/api/creative-questions?${params.toString()}`);
      setLoading(false);

      if (!result.success) {
        setError(result.error.message);
        setCreativeItems([]);
        return;
      }

      setCreativeItems(result.data);
      setMeta(result.meta ?? null);
    }
  }, [page, search, type, difficulty, mine, withAnswers, canReadAnswers, activeTab]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const handleTabChange = (tab: "standard" | "creative") => {
    setActiveTab(tab);
    setPage(1);
    if (tab === "creative") {
      setType("CQ");
    } else if (type === "CQ") {
      setType("");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Question Bank</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse and search questions across taxonomy. Answer keys are shown only to roles permitted to see them.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange("standard")}
          className={`border-b-2 px-5 py-2.5 text-sm transition-colors ${
            activeTab === "standard"
              ? "border-brand-600 font-semibold text-brand-600"
              : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          Standard Questions
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("creative")}
          className={`border-b-2 px-5 py-2.5 text-sm transition-colors ${
            activeTab === "creative"
              ? "border-brand-600 font-semibold text-brand-600"
              : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          Creative Questions (CQ) / সৃজনশীল
        </button>
      </div>

      <Card>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void load();
          }}
        >
          <Field label="Search">
            {({ id }) => (
              <TextInput
                id={id}
                value={search}
                placeholder="Search text or stimulus..."
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </Field>

          {activeTab === "standard" ? (
            <Field label="Type">
              {({ id }) => (
                <Select
                  id={id}
                  value={type}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val === "CQ") {
                      handleTabChange("creative");
                    } else {
                      setType(val);
                    }
                  }}
                >
                  <option value="">All standard types</option>
                  {QUESTION_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </option>
                  ))}
                  <option value="CQ">Creative Question (CQ)</option>
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Type">
              {({ id }) => (
                <Select id={id} value="CQ" disabled>
                  <option value="CQ">Creative Question (CQ)</option>
                </Select>
              )}
            </Field>
          )}

          <Field label="Difficulty">
            {({ id }) => (
              <Select
                id={id}
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                <option value="">All difficulties</option>
                {DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={mine}
                onChange={(event) => {
                  setMine(event.target.checked);
                  setPage(1);
                }}
              />
              Only mine
            </label>
            {canReadAnswers ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={withAnswers}
                  onChange={(event) => setWithAnswers(event.target.checked)}
                />
                Show answer keys
              </label>
            ) : null}
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </Card>

      <Card>
        {error ? <Alert tone="error">{error}</Alert> : null}

        {loading ? (
          <Spinner label={activeTab === "standard" ? "Loading questions" : "Loading creative questions"} />
        ) : activeTab === "standard" ? (
          items.length === 0 ? (
            <EmptyState
              title="No questions found"
              body="Adjust the filters, or create a new question."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item._id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{item.type.replace(/_/g, " ")}</Badge>
                    {item.difficulty ? <Badge>{item.difficulty}</Badge> : null}
                    <Badge tone={STATUS_TONE[item.status] ?? "slate"}>{item.status}</Badge>
                    <Badge>{item.marks} mark(s)</Badge>
                  </div>

                  <p className="mt-3 text-sm text-slate-800">{item.question.text}</p>

                  {item.tags.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">{item.tags.join(" · ")}</p>
                  ) : null}

                  {item.answersIncluded && item.answer ? (
                    <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      <span className="font-semibold">Answer: </span>
                      {item.answer.correctOptions.length > 0
                        ? item.answer.correctOptions.join(", ")
                        : item.answer.booleanAnswer !== null
                          ? String(item.answer.booleanAnswer)
                          : item.answer.text}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : (
          creativeItems.length === 0 ? (
            <EmptyState
              title="No creative questions found"
              body="Adjust the filters, or create a new creative question (CQ)."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {creativeItems.map((item) => (
                <li key={item._id} className="rounded-xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">Creative Question (CQ)</Badge>
                    {item.difficulty ? <Badge>{item.difficulty}</Badge> : null}
                    <Badge tone={STATUS_TONE[item.status] ?? "slate"}>{item.status}</Badge>
                    <Badge tone="green">10 marks</Badge>
                    {item.subject?.name ? (
                      <span className="text-xs text-slate-500">
                        {item.subject.name}
                        {item.chapter?.name ? ` · ${item.chapter.name}` : ""}
                      </span>
                    ) : null}
                  </div>

                  {/* Stimulus / উদ্দীপক */}
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      উদ্দীপক / Stimulus
                    </span>
                    <p className="whitespace-pre-line text-sm text-slate-900 leading-relaxed">
                      {item.stimulus}
                    </p>
                  </div>

                  {/* Instruction */}
                  {item.instruction ? (
                    <p className="mt-2 text-xs italic text-slate-600">{item.instruction}</p>
                  ) : null}

                  {/* ক, খ, গ, ঘ Sub-questions */}
                  <div className="mt-3 space-y-2">
                    {item.questions.map((part, index) => (
                      <div key={index} className="rounded-lg border border-slate-100 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm text-slate-900">
                            <strong className="font-semibold text-brand-700">
                              ({PART_LABELS[index] ?? index + 1})
                            </strong>{" "}
                            {part.text}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            [{part.marks}]
                          </span>
                        </div>

                        {withAnswers && canReadAnswers && part.answer ? (
                          <div className="mt-2 rounded bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                            <span className="font-semibold">Answer ({PART_LABELS[index] ?? index + 1}): </span>
                            {part.answer}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {meta ? (
          <div className="mt-6">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onChange={setPage}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
