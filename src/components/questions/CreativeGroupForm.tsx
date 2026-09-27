"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Card, Field, Select, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { DIFFICULTIES, OPTION_BASED_TYPES, QUESTION_TYPES, type QuestionType } from "@/types/question";

interface Option { id: string; text: string }
interface Part {
  type: QuestionType;
  text: string;
  answerText: string;
  booleanAnswer: "" | "true" | "false";
  options: Option[];
  correctOptions: string[];
  matchingPairs: { left: string; right: string }[];
  difficulty: string;
  language: string;
  explanation: string;
}
interface TaxonomyOption { _id: string; name: string }

const LABELS = [
  { label: "ক", level: "knowledge", title: "জ্ঞানমূলক", marks: 1 },
  { label: "খ", level: "understanding", title: "অনুধাবনমূলক", marks: 2 },
  { label: "গ", level: "application", title: "প্রয়োগমূলক", marks: 3 },
  { label: "ঘ", level: "higher_order", title: "উচ্চতর দক্ষতামূলক", marks: 4 },
] as const;

function emptyPart(): Part {
  return {
    type: "WRITTEN",
    text: "",
    answerText: "",
    booleanAnswer: "",
    options: ["A", "B", "C", "D"].map((id) => ({ id, text: "" })),
    correctOptions: [],
    matchingPairs: [{ left: "", right: "" }, { left: "", right: "" }],
    difficulty: "",
    language: "bn",
    explanation: "",
  };
}

function payloadPart(part: Part, label: typeof LABELS[number]["label"], level: typeof LABELS[number]["level"]) {
  const usesOptions = OPTION_BASED_TYPES.includes(part.type);
  return {
    type: part.type,
    difficulty: part.difficulty || null,
    language: part.language,
    question: { text: part.text },
    options: usesOptions ? part.options.filter((option) => option.text.trim()) : [],
    answer: {
      text: part.answerText,
      correctOptions: usesOptions ? part.correctOptions : [],
      booleanAnswer: part.type === "TRUE_FALSE" && part.booleanAnswer ? part.booleanAnswer === "true" : null,
      matchingPairs: part.type === "MATCHING"
        ? part.matchingPairs.filter((pair) => pair.left.trim() && pair.right.trim())
        : [],
    },
    explanation: part.explanation,
    marks: LABELS.find((item) => item.label === label)?.marks,
    status: "DRAFT",
    creativePartLabel: label,
    cognitiveLevel: level,
  };
}

export default function CreativeGroupForm({
  canReview: _canReview,
  onCancel,
}: {
  canReview: boolean;
  onCancel: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [chapters, setChapters] = useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = useState<TaxonomyOption[]>([]);
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [stimulus, setStimulus] = useState("");
  const [parts, setParts] = useState<Part[]>(LABELS.map(() => emptyPart()));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiFetch<TaxonomyOption[]>("/api/categories?limit=100").then((result) => {
      if (result.success) setCategories(result.data);
    });
  }, []);
  useEffect(() => {
    if (!category) { queueMicrotask(() => setSubjects([])); return; }
    void apiFetch<TaxonomyOption[]>(`/api/subjects?limit=100&category=${category}`).then((result) => setSubjects(result.success ? result.data : []));
  }, [category]);
  useEffect(() => {
    if (!subject) { queueMicrotask(() => setChapters([])); return; }
    void apiFetch<TaxonomyOption[]>(`/api/chapters?limit=100&subject=${subject}`).then((result) => setChapters(result.success ? result.data : []));
  }, [subject]);
  useEffect(() => {
    if (!chapter) { queueMicrotask(() => setTopics([])); return; }
    void apiFetch<TaxonomyOption[]>(`/api/topics?limit=100&chapter=${chapter}`).then((result) => setTopics(result.success ? result.data : []));
  }, [chapter]);

  function updatePart(index: number, patch: Partial<Part>) {
    setParts((current) => current.map((part, partIndex) => partIndex === index ? { ...part, ...patch } : part));
  }

  async function save() {
    setError("");
    if (!category || !subject || !chapter || !stimulus.trim()) {
      setError("Select category, subject, chapter and provide the stimulus.");
      return;
    }
    for (const [index, part] of parts.entries()) {
      if (!part.text.trim()) { setError(`Enter question ${LABELS[index]!.label}.`); return; }
      if (OPTION_BASED_TYPES.includes(part.type)) {
        if (part.options.filter((option) => option.text.trim()).length < 2 || part.correctOptions.length < (part.type === "MCQ" ? 1 : 2)) {
          setError(`Complete the options and answer for ${LABELS[index]!.label}.`);
          return;
        }
      } else if (part.type === "TRUE_FALSE") {
        if (!part.booleanAnswer) { setError(`Select True or False for ${LABELS[index]!.label}.`); return; }
      } else if (part.type === "MATCHING") {
        if (part.matchingPairs.filter((pair) => pair.left.trim() && pair.right.trim()).length < 2) {
          setError(`Enter at least two matching pairs for ${LABELS[index]!.label}.`);
          return;
        }
      } else if (!part.answerText.trim()) {
        setError(`Enter the answer for ${LABELS[index]!.label}.`);
        return;
      }
    }

    setSaving(true);
    const result = await apiFetch("/api/questions/creative-group", {
      method: "POST",
      json: {
        category, subject, chapter, topic: topic || null,
        creativeStimulus: stimulus.trim(),
        parts: parts.map((part, index) => payloadPart(part, LABELS[index]!.label, LABELS[index]!.level)),
      },
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    toast.success("Creative Question saved as four draft questions.");
    router.push("/dashboard/questions");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Creative Question</h2>
          <p className="text-sm text-slate-500">One stimulus with four related questions (10 marks).</p>
        </div>
        <Button variant="secondary" onClick={onCancel}>Back to standard question</Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Category" required>
            {({ id }) => <Select id={id} value={category} onChange={(event) => { setCategory(event.target.value); setSubject(""); setChapter(""); setTopic(""); }}>
              <option value="">Select category</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>}
          </Field>
          <Field label="Subject" required>
            {({ id }) => <Select id={id} value={subject} disabled={!category} onChange={(event) => { setSubject(event.target.value); setChapter(""); setTopic(""); }}>
              <option value="">Select subject</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>}
          </Field>
          <Field label="Chapter" required>
            {({ id }) => <Select id={id} value={chapter} disabled={!subject} onChange={(event) => { setChapter(event.target.value); setTopic(""); }}>
              <option value="">Select chapter</option>{chapters.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>}
          </Field>
          <Field label="Topic">
            {({ id }) => <Select id={id} value={topic} disabled={!chapter} onChange={(event) => setTopic(event.target.value)}>
              <option value="">None</option>{topics.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="উদ্দীপক" required>
            {({ id }) => <textarea id={id} value={stimulus} onChange={(event) => setStimulus(event.target.value)} rows={5} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />}
          </Field>
        </div>
      </Card>
      {parts.map((part, index) => {
        const meta = LABELS[index]!;
        const usesOptions = OPTION_BASED_TYPES.includes(part.type);
        return <Card key={meta.label}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{meta.label}) {meta.title} — {meta.marks} marks</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Question Type">
              {({ id }) => <Select id={id} value={part.type} onChange={(event) => updatePart(index, { type: event.target.value as QuestionType })}>
                {QUESTION_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
              </Select>}
            </Field>
            <Field label="Difficulty">
              {({ id }) => <Select id={id} value={part.difficulty} onChange={(event) => updatePart(index, { difficulty: event.target.value })}>
                <option value="">Unset</option>{DIFFICULTIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>}
            </Field>
          </div>
          <div className="mt-4">
            <Field label={`Question (${meta.label})`} required>
              {({ id }) => <textarea id={id} value={part.text} onChange={(event) => updatePart(index, { text: event.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />}
            </Field>
          </div>
          {usesOptions ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {part.options.map((option, optionIndex) => <label key={option.id} className="flex items-center gap-2 text-sm">
              <input type={part.type === "MCQ" || part.type === "ASSERTION_REASON" ? "radio" : "checkbox"}
                checked={part.correctOptions.includes(option.id)}
                onChange={() => updatePart(index, { correctOptions: part.type === "MCQ" || part.type === "ASSERTION_REASON"
                  ? [option.id]
                  : part.correctOptions.includes(option.id) ? part.correctOptions.filter((id) => id !== option.id) : [...part.correctOptions, option.id] })}
              />
              <span className="font-medium">{option.id}</span>
              <TextInput value={option.text} onChange={(event) => updatePart(index, { options: part.options.map((item, i) => i === optionIndex ? { ...item, text: event.target.value } : item) })} placeholder={`Option ${option.id}`} />
            </label>)}
            <p className="text-xs text-slate-500 sm:col-span-2">Mark the correct option(s) using the selector.</p>
          </div> : part.type === "TRUE_FALSE" ? <div className="mt-4">
            <Field label="Correct answer">
              {({ id }) => <Select id={id} value={part.booleanAnswer} onChange={(event) => updatePart(index, { booleanAnswer: event.target.value as Part["booleanAnswer"] })}>
                <option value="">Select answer</option><option value="true">True</option><option value="false">False</option>
              </Select>}
            </Field>
          </div> : part.type === "MATCHING" ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {part.matchingPairs.map((pair, pairIndex) => <div key={pairIndex} className="flex gap-2">
              <TextInput value={pair.left} placeholder="Left" onChange={(event) => updatePart(index, { matchingPairs: part.matchingPairs.map((item, i) => i === pairIndex ? { ...item, left: event.target.value } : item) })} />
              <TextInput value={pair.right} placeholder="Match" onChange={(event) => updatePart(index, { matchingPairs: part.matchingPairs.map((item, i) => i === pairIndex ? { ...item, right: event.target.value } : item) })} />
            </div>)}
          </div> : <div className="mt-4">
            <Field label="Answer" required>
              {({ id }) => <textarea id={id} value={part.answerText} onChange={(event) => updatePart(index, { answerText: event.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />}
            </Field>
          </div>}
        </Card>;
      })}
      <div className="flex justify-end"><Button onClick={() => void save()} loading={saving}>Save CQ as Draft</Button></div>
    </div>
  );
}
