"use client";

interface PopulatedRef {
  _id?: string;
  name?: string;
}

interface QuestionOption {
  id: string;
  text?: string;
  image?: string;
}

interface QuestionCardProps {
  question: {
    _id: string;
    question?: { text?: string; image?: string; latex?: string };
    options?: QuestionOption[];
    answer?: {
      text?: string;
      correctOptions?: string[];
      booleanAnswer?: boolean | null;
    };
    explanation?: string;
    type?: string;
    difficulty?: string | null;
    chapter?: PopulatedRef;
    subject?: PopulatedRef;
    board?: PopulatedRef;
    exam?: PopulatedRef;
    tags?: string[];
    aiGenerated?: boolean;
    status?: string;
  };
  index: number;
}

const difficultyStyles: Record<string, string> = {
  Easy: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Hard: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  const toneClass =
    tone === "default"
      ? "bg-slate-50 text-slate-600 ring-slate-500/15"
      : difficultyStyles[tone] ?? "bg-slate-50 text-slate-600 ring-slate-500/15";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass}`}
    >
      {children}
    </span>
  );
}

export default function QuestionCard({ question, index }: QuestionCardProps) {
  const correctOptionIds = new Set(question.answer?.correctOptions ?? []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {index + 1}
        </span>
        {question.difficulty && (
          <Pill tone={question.difficulty}>{question.difficulty}</Pill>
        )}
        {question.type && <Pill>{question.type.replace(/_/g, " ")}</Pill>}
        {question.subject?.name && <Pill>{question.subject.name}</Pill>}
        {question.chapter?.name && <Pill>{question.chapter.name}</Pill>}
        {question.board?.name && <Pill>{question.board.name}</Pill>}
        {question.exam?.name && <Pill>{question.exam.name}</Pill>}
        {question.aiGenerated && (
          <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
            AI Generated
          </span>
        )}
      </div>

      <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-900">
        {question.question?.text}
      </p>

      {question.question?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.question.image}
          alt="Question illustration"
          className="mt-3 max-h-64 rounded-lg border border-slate-200 object-contain"
        />
      )}

      {question.options && question.options.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {question.options.map((opt) => {
            const isCorrect = correctOptionIds.has(opt.id);
            return (
              <div
                key={opt.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <span className="font-semibold">{opt.id}.</span>
                <span>{opt.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {(question.answer?.text || question.answer?.booleanAnswer !== null) && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="font-semibold">Answer: </span>
          {question.answer?.text ||
            (question.answer?.booleanAnswer === true ? "True" : "False")}
        </div>
      )}

      {question.explanation && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Explanation: </span>
          {question.explanation}
        </div>
      )}

      {question.tags && question.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
