"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  Spinner,
} from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { CSV_TEMPLATE, mapRowToQuestion, parseCsv } from "@/lib/import/csv";

/**
 * Bulk import UI for the existing /api/questions/bulk endpoint.
 *
 * Large imports are handled by chunking client-side: the endpoint caps a request
 * at 500 questions, so a 5,000-row file is sent as ten sequential requests with
 * visible progress. Sequential rather than parallel is deliberate — it keeps the
 * database load predictable and stays inside the import rate limit.
 */

interface TaxonomyOption {
  _id: string;
  name: string;
}

interface ImportError {
  index: number;
  message: string;
  details?: { path: string; message: string }[];
}

interface BulkResult {
  received: number;
  inserted: number;
  failed: number;
  errors: ImportError[];
}

const CHUNK_SIZE = 500;

interface Props {
  categories: TaxonomyOption[];
}

export default function BulkImport({ categories }: Props) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [parseIssues, setParseIssues] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");

  const chunks = useMemo(() => Math.ceil(rows.length / CHUNK_SIZE), [rows.length]);

  async function loadSubjects(categoryId: string) {
    setCategory(categoryId);
    setSubject("");
    setChapter("");
    setChapters([]);

    if (!categoryId) {
      setSubjects([]);
      return;
    }

    const result = await apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${categoryId}`);
    setSubjects(result.success ? result.data : []);
  }

  async function loadChapters(subjectId: string) {
    setSubject(subjectId);
    setChapter("");

    if (!subjectId) {
      setChapters([]);
      return;
    }

    const result = await apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subjectId}`);
    setChapters(result.success ? result.data : []);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!category || !subject || !chapter) {
      setError("Choose the destination category, subject and chapter first.");
      event.target.value = "";
      return;
    }

    setError("");
    setSummary(null);
    setParsing(true);
    setFileName(file.name);

    try {
      const text = await file.text();
      const issues: string[] = [];
      let mapped: Record<string, unknown>[] = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed: unknown = JSON.parse(text);
        const list = Array.isArray(parsed)
          ? parsed
          : typeof parsed === "object" && parsed !== null && "questions" in parsed
            ? ((parsed as { questions?: unknown }).questions ?? [])
            : [];

        if (!Array.isArray(list)) {
          issues.push("JSON must be an array of questions, or an object with a `questions` array.");
        } else {
          // JSON is assumed to be in API shape; defaults fill missing placement.
          mapped = list.map((entry) => ({
            category,
            subject,
            chapter,
            ...(entry as Record<string, unknown>),
          }));
        }
      } else {
        const parsed = parseCsv(text);

        for (const bad of parsed.malformed) {
          issues.push(`Line ${bad.line}: ${bad.message}`);
        }

        mapped = parsed.rows.map((row, index) => {
          const result = mapRowToQuestion(row, index, { category, subject, chapter });
          for (const issue of result.issues) {
            issues.push(`Row ${index + 1}: ${issue}`);
          }
          return result.payload;
        });
      }

      setRows(mapped);
      setParseIssues(issues.slice(0, 50));
    } catch (parseError: unknown) {
      setError(
        parseError instanceof Error
          ? `Could not read the file: ${parseError.message}`
          : "Could not read the file.",
      );
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (rows.length === 0) return;

    setImporting(true);
    setError("");
    setProgress({ done: 0, total: chunks });

    const aggregate: BulkResult = { received: 0, inserted: 0, failed: 0, errors: [] };

    for (let index = 0; index < chunks; index += 1) {
      const slice = rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);

      const result = await apiFetch<BulkResult>("/api/questions/bulk", {
        method: "POST",
        json: { questions: slice },
      });

      if (!result.success) {
        setError(`Chunk ${index + 1} failed: ${result.error.message}`);
        break;
      }

      aggregate.received += result.data.received;
      aggregate.inserted += result.data.inserted;
      aggregate.failed += result.data.failed;
      aggregate.errors.push(
        // Offset indices back to the original file row numbers.
        ...result.data.errors.map((issue) => ({
          ...issue,
          index: issue.index + index * CHUNK_SIZE,
        })),
      );

      setProgress({ done: index + 1, total: chunks });
    }

    setImporting(false);
    setSummary(aggregate);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "autoqgen-question-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const ready = rows.length > 0 && !importing;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bulk import</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload a CSV or JSON file. Files larger than {CHUNK_SIZE} questions are sent in batches
            automatically.
          </p>
        </div>
        <Button variant="secondary" onClick={downloadTemplate}>
          Download CSV template
        </Button>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800">1. Destination</h2>
        <p className="mt-1 text-xs text-slate-500">
          Applied to every row that does not specify its own chapter.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Category" required>
            {({ id }) => (
              <Select id={id} value={category} onChange={(event) => loadSubjects(event.target.value)}>
                <option value="">Select…</option>
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
              <Select id={id} value={subject} onChange={(event) => loadChapters(event.target.value)}>
                <option value="">Select…</option>
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
              <Select id={id} value={chapter} onChange={(event) => setChapter(event.target.value)}>
                <option value="">Select…</option>
                {chapters.map((option) => (
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
        <h2 className="text-sm font-semibold text-slate-800">2. File</h2>
        <div className="mt-4">
          <Field label="CSV or JSON file">
            {({ id }) => (
              <input
                id={id}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleFile}
                disabled={!chapter}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 disabled:opacity-50"
              />
            )}
          </Field>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        {parsing ? <Spinner label="Reading file" /> : null}

        {fileName && !parsing ? (
          <p className="mt-3 text-sm text-slate-600">
            <span className="font-medium">{fileName}</span> — {rows.length} question(s) parsed
            {parseIssues.length > 0 ? `, ${parseIssues.length} local warning(s)` : ""}.
          </p>
        ) : null}

        {parseIssues.length > 0 ? (
          <details className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            <summary className="cursor-pointer font-medium">
              {parseIssues.length} row warning(s) — these rows will still be sent and validated by
              the server
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {parseIssues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      {rows.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800">3. Preview</h2>
          <p className="mt-1 text-xs text-slate-500">First 10 of {rows.length} rows.</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Import preview</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-4">#</th>
                  <th scope="col" className="py-2 pr-4">Type</th>
                  <th scope="col" className="py-2 pr-4">Question</th>
                  <th scope="col" className="py-2 pr-4">Difficulty</th>
                  <th scope="col" className="py-2">Marks</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, index) => {
                  const question = row.question as { text?: string } | undefined;
                  return (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-400">{index + 1}</td>
                      <td className="py-2 pr-4">
                        <Badge tone="brand">{String(row.type ?? "—")}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-800">
                        {(question?.text ?? "").slice(0, 90) || "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{String(row.difficulty ?? "—")}</td>
                      <td className="py-2 text-slate-500">{String(row.marks ?? 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button loading={importing} disabled={!ready} onClick={runImport}>
              Import {rows.length} question(s)
            </Button>
            {importing ? (
              <span className="text-sm text-slate-600">
                Batch {progress.done} of {progress.total}…
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}

      {summary ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Import summary</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Received</p>
              <p className="text-2xl font-semibold text-slate-900">{summary.received}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Imported</p>
              <p className="text-2xl font-semibold text-emerald-900">{summary.inserted}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs text-red-700">Failed</p>
              <p className="text-2xl font-semibold text-red-900">{summary.failed}</p>
            </div>
          </div>

          {summary.errors.length > 0 ? (
            <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Rows that failed to import</caption>
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-2">Row</th>
                    <th scope="col" className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.errors.map((issue, index) => (
                    <tr key={index} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2 text-slate-500">{issue.index + 1}</td>
                      <td className="px-3 py-2 text-slate-800">
                        {issue.message}
                        {issue.details ? (
                          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500">
                            {issue.details.map((detail, detailIndex) => (
                              <li key={detailIndex}>
                                {detail.path}: {detail.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <Alert tone="success">Every row imported successfully.</Alert>
            </div>
          )}
        </Card>
      ) : null}

      {rows.length === 0 && !parsing && !fileName ? (
        <EmptyState
          title="No file selected"
          body="Choose a destination above, then upload a CSV or JSON file to preview it."
        />
      ) : null}
    </div>
  );
}
