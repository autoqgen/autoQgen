import { Question } from "../types";

interface Props {
  question: Question;
  index: number;
}

export default function QuestionCard({
  question,
  index,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6">

      {/* Header */}

      <div className="flex items-center justify-between mb-5">

        <div className="flex items-center gap-3">

          <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
            #{index + 1}
          </span>

          <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">
            {question.type}
          </span>

          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
            {question.difficulty}
          </span>

        </div>

      </div>

      {/* Question */}

      <h2 className="text-lg font-semibold text-gray-900 mb-5">
        {question.question.text}
      </h2>

      {/* Options */}

      {question.options.length > 0 && (
        <div className="space-y-3">

          {question.options.map((option) => {

            const isCorrect =
              question.answer.correctOptions.includes(option.id);

            return (
              <div
                key={option.id}
                className={`border rounded-xl p-4 flex items-start gap-3 ${
                  isCorrect
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <div className="font-bold">
                  {option.id}.
                </div>

                <div className="flex-1">
                  {option.text}
                </div>

                {isCorrect && (
                  <span className="text-green-600 font-semibold">
                    ✓
                  </span>
                )}
              </div>
            );
          })}

        </div>
      )}

      {/* Answer */}

      {question.answer.correctOptions.length > 0 && (
        <div className="mt-6 border-t pt-4">

          <h3 className="font-semibold mb-2">
            Correct Answer
          </h3>

          <div className="text-green-700 font-bold">
            {question.answer.correctOptions.join(", ")}
          </div>

        </div>
      )}

    </div>
  );
}