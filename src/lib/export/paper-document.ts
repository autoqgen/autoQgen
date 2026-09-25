import type { PaperDoc } from "@/lib/repositories/paper.repo";
import type { ExportVariant } from "@/types/paper";

/**
 * Format-neutral document model.
 *
 * PDF and DOCX exporters both consume this, so the two outputs cannot drift
 * apart in structure — which is the requirement that the DOCX "match the PDF
 * structure". Answer inclusion is decided once, here, from the variant the
 * service has already authorised.
 */

export interface RenderedOption {
  label: string;
  text: string;
}

export interface RenderedQuestion {
  number: number;
  text: string;
  marks: number;
  type: string;
  difficulty: string | null;
  options: RenderedOption[];
  note: string;
  /** Present only in the teacher variant. */
  answer: string | null;
  explanation: string | null;
  creative?: {
    stimulus: string;
    instruction: string;
    parts: { label: string; text: string; marks: number; answer: string | null }[];
  };
}

export interface RenderedSection {
  title: string;
  instructions: string;
  questions: RenderedQuestion[];
  sectionMarks: number;
}

export interface RenderedPaper {
  title: string;
  subtitle: string;
  variant: ExportVariant;
  instructions: string;
  meta: { label: string; value: string }[];
  sections: RenderedSection[];
  totalMarks: number;
  totalQuestions: number;
  marksByType: { label: string; count: number; marks: number }[];
  generatedAt: Date;
}

interface PopulatedRef {
  name?: string;
  shortName?: string;
  year?: number;
}

interface PopulatedQuestion {
  _id?: unknown;
  question?: { text?: string };
  options?: { id?: string; text?: string }[];
  answer?: {
    text?: string;
    correctOptions?: string[];
    booleanAnswer?: boolean | null;
    matchingPairs?: { left: string; right: string }[];
  };
  explanation?: string;
  type?: string;
  difficulty?: string | null;
  marks?: number;
}

function asRef(value: unknown): PopulatedRef | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PopulatedRef;
  }
  return null;
}

/** Renders a stored answer object into a single human-readable line. */
export function formatAnswer(answer: PopulatedQuestion["answer"], options: RenderedOption[]): string {
  if (!answer) return "";

  if (answer.correctOptions && answer.correctOptions.length > 0) {
    const labels = answer.correctOptions.map((id) => {
      const match = options.find((option) => option.label.toUpperCase() === id.toUpperCase());
      return match ? `${match.label}. ${match.text}` : id;
    });
    return labels.join("   ");
  }

  if (answer.booleanAnswer !== null && answer.booleanAnswer !== undefined) {
    return answer.booleanAnswer ? "True" : "False";
  }

  if (answer.matchingPairs && answer.matchingPairs.length > 0) {
    return answer.matchingPairs.map((pair) => `${pair.left} → ${pair.right}`).join("; ");
  }

  return answer.text ?? "";
}

export function buildRenderedPaper(paper: PaperDoc, variant: ExportVariant): RenderedPaper {
  const includeAnswers = variant === "teacher";

  const subject = asRef(paper.subject);
  const category = asRef(paper.category);
  const board = asRef(paper.board);
  const exam = asRef(paper.exam);

  const meta: { label: string; value: string }[] = [];
  if (subject?.name) meta.push({ label: "Subject", value: subject.name });
  if (category?.name) meta.push({ label: "Class", value: category.name });
  if (board?.name) meta.push({ label: "Board", value: board.name });
  if (exam?.name) meta.push({ label: "Exam", value: exam.name });
  if (paper.year) meta.push({ label: "Year", value: String(paper.year) });
  if (paper.durationMinutes) {
    meta.push({ label: "Time", value: `${paper.durationMinutes} minutes` });
  }
  meta.push({ label: "Full marks", value: String(paper.totalMarks) });

  let counter = 0;
  const typeTotals = new Map<string, { count: number; marks: number }>();

  const sections: RenderedSection[] = paper.sections.map((section) => {
    let sectionMarks = 0;

    const questions: RenderedQuestion[] = section.questions.map((entry) => {
      const source = entry.question as unknown as PopulatedQuestion | null;
      const creative = (entry as unknown as { creativeQuestion?: { stimulus?: string; instruction?: string; questions?: { text?: string; answer?: string; marks?: number; order?: number }[] } | null }).creativeQuestion;
      counter += 1;
      sectionMarks += entry.marks;

      const type = creative ? "CQ" : source?.type ?? "UNKNOWN";
      const existing = typeTotals.get(type) ?? { count: 0, marks: 0 };
      typeTotals.set(type, { count: existing.count + 1, marks: existing.marks + entry.marks });

      const options: RenderedOption[] = (source?.options ?? []).map((option, index) => ({
        label: option.id ?? String.fromCharCode(65 + index),
        text: option.text ?? "",
      }));

      return {
        number: counter,
        text: creative ? creative.stimulus ?? "" : source?.question?.text ?? "[question unavailable]",
        marks: entry.marks,
        type,
        difficulty: source?.difficulty ?? null,
        options,
        note: entry.note ?? "",
        answer: includeAnswers ? formatAnswer(source?.answer, options) : null,
        explanation: includeAnswers ? (source?.explanation ?? "") : null,
        creative: creative
          ? {
              stimulus: creative.stimulus ?? "",
              instruction: creative.instruction ?? "",
              parts: (creative.questions ?? [])
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((part, index) => ({
                  label: ["ক", "খ", "গ", "ঘ"][index] ?? String(index + 1),
                  text: part.text ?? "",
                  marks: part.marks ?? index + 1,
                  answer: includeAnswers ? part.answer ?? "" : null,
                })),
            }
          : undefined,
      };
    });

    return {
      title: section.title ?? "",
      instructions: section.instructions ?? "",
      questions,
      sectionMarks,
    };
  });

  return {
    title: paper.title,
    subtitle: variant === "teacher" ? "Teacher copy — includes answer key" : "",
    variant,
    instructions: paper.instructions ?? "",
    meta,
    sections,
    totalMarks: paper.totalMarks,
    totalQuestions: paper.totalQuestions,
    marksByType: Array.from(typeTotals.entries())
      .map(([label, value]) => ({ label: label.replace(/_/g, " "), ...value }))
      .sort((a, b) => b.marks - a.marks),
    generatedAt: new Date(),
  };
}
