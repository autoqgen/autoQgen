import QuestionCard from "./QuestionCard";
import type { ChatTurn } from "./ChatWindow";

export default function ChatMessage({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-[15px] text-white">
          {turn.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-[15px] text-slate-800">
          {turn.text}
        </div>
      </div>

      {turn.questions && turn.questions.length > 0 && (
        <div className="grid gap-3">
          {turn.questions.map((q, i) => (
            <QuestionCard key={q._id ?? i} question={q} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
