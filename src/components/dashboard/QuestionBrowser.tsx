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
  creativeGroupId?: string;
  creativePartOrder?: number;
  creativePartLabel?: string;
  creativeStimulus?: string;
  options?: { id: string; text: string }[];
  answer?: { text: string; correctOptions: string[]; booleanAnswer: boolean | null };
}

interface DisplayQuestionGroup {
  key: string;
  questions: BrowserQuestion[];
  stimulus?: string;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "green",
  PENDING: "amber",
  DRAFT: "slate",
  REJECTED: "red",
};

export default function QuestionBrowser({ canReadAnswers }: { canReadAnswers: boolean }) {
  const [items, setItems] = useState<BrowserQuestion[]>([]);

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

    if (type === "CQ") params.set("creativeOnly", "true");
    else if (type) params.set("type", type);
    const result = await apiFetch<BrowserQuestion[]>(`/api/questions?${params.toString()}`);
    setLoading(false);

    if (!result.success) {
      setError(result.error.message);
      setItems([]);
      return;
    }

    setItems(type === "CQ" ? result.data.filter((item) => Boolean(item.creativeGroupId)) : result.data);
    setMeta(result.meta ?? null);
  }, [page, search, type, difficulty, mine, withAnswers, canReadAnswers]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const displayGroups = (() => {
    const groups = new Map<string, DisplayQuestionGroup>();
    for (const item of items) {
      const key = item.creativeGroupId ? `cq:${item.creativeGroupId}` : `q:${item._id}`;
      const group = groups.get(key) ?? { key, questions: [], stimulus: item.creativeStimulus };
      group.questions.push(item);
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      questions: group.questions.sort((a, b) => (a.creativePartOrder ?? 1) - (b.creativePartOrder ?? 1)),
    }));
  })();

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
                placeholder="Search question text..."
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </Field>

          <Field label="Type">
            {({ id }) => (
              <Select id={id} value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">All question types</option>
                <option value="CQ">CQ (Creative Question)</option>
                {QUESTION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
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
          <Spinner label="Loading questions" />
        ) : (
          displayGroups.length === 0 ? (
            <EmptyState
              title="No questions found"
              body="Adjust the filters, or create a new question."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {displayGroups.map((group) => group.questions[0]?.creativeGroupId ? (
                <li key={group.key} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">Creative Question</Badge>
                    <Badge tone={STATUS_TONE[group.questions[0]?.status ?? "DRAFT"] ?? "slate"}>
                      {group.questions[0]?.status ?? "DRAFT"}
                    </Badge>
                    <Badge>{group.questions.length === 4 ? "10 marks" : "Incomplete group"}</Badge>
                  </div>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <strong>উদ্দীপক:</strong>
                    <p className="whitespace-pre-wrap text-sm">{group.stimulus ?? "Stimulus missing."}</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {group.questions.map((item) => (
                      <div key={item._id} className="rounded border border-slate-100 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{item.creativePartLabel ?? `Part ${item.creativePartOrder ?? ""}`}</strong>
                          <Badge tone="brand">{item.type.replace(/_/g, " ")}</Badge>
                          {item.difficulty ? <Badge>{item.difficulty}</Badge> : null}
                          <Badge>{item.marks} mark(s)</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-800">{item.question.text}</p>
                        {item.options?.length ? <ul className="mt-2 text-sm text-slate-700">{item.options.map((option) => <li key={option.id}>({option.id}) {option.text}</li>)}</ul> : null}
                        {item.answersIncluded && item.answer ? (
                          <p className="mt-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                            <strong>Answer: </strong>{item.answer.correctOptions.length
                              ? item.answer.correctOptions.join(", ")
                              : item.answer.booleanAnswer !== null
                                ? String(item.answer.booleanAnswer)
                                : item.answer.text}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </li>
              ) : group.questions.map((item) => (
                <li key={item._id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{item.type.replace(/_/g, " ")}</Badge>
                    {item.difficulty ? <Badge>{item.difficulty}</Badge> : null}
                    <Badge tone={STATUS_TONE[item.status] ?? "slate"}>{item.status}</Badge>
                    <Badge>{item.marks} mark(s)</Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-800">{item.question.text}</p>
                  {item.tags.length > 0 ? <p className="mt-2 text-xs text-slate-500">{item.tags.join(" · ")}</p> : null}
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
              )))}
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
