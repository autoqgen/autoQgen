import QuestionCard from "./QuestionCard";
import { Question } from "../types";

interface Props {
  questions: Question[];
  loading?: boolean;
}

export default function QuestionList({
  questions,
  loading = false,
}: Props) {
  /* ===========================
     Loading State
  =========================== */

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-10 text-center">
        <p className="text-gray-500 text-lg">
          Loading questions...
        </p>
      </div>
    );
  }

  /* ===========================
     Empty State
  =========================== */

  if (!questions.length) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-10 text-center">
        <h2 className="text-xl font-semibold text-gray-700">
          No Questions Found
        </h2>

        <p className="text-gray-500 mt-2">
          Select Category, Subject, Chapter and Question Type,
          then click <strong>Get Questions</strong>.
        </p>
      </div>
    );
  }

  /* ===========================
     Question List
  =========================== */

  return (
    <div className="space-y-6">

      {/* Summary */}

      <div className="flex items-center justify-between bg-white border rounded-2xl p-5 shadow-sm">
        <h2 className="text-xl font-bold">
          Questions
        </h2>

        <span className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
          Total: {questions.length}
        </span>
      </div>

      {/* Cards */}

      {questions.map((question, index) => (
        <QuestionCard
          key={question._id}
          question={question}
          index={index}
        />
      ))}

    </div>
  );
}