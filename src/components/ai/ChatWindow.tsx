"use client";

import { useEffect, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import LoadingIndicator from "./LoadingIndicator";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions?: any[];
}

const SUGGESTIONS = [
  "Physics এর Force chapter থেকে 20 Medium MCQ দাও",
  "SSC Physics Hard Question",
  "Dhaka Board Physics Question",
  "Only AI Generated Question",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChatWindow() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function handleSend(message: string) {
    const userTurn: ChatTurn = { id: uid(), role: "user", text: message };
    setTurns((prev) => [...prev, userTurn]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      const assistantTurn: ChatTurn = {
        id: uid(),
        role: "assistant",
        text: data.message ?? "No matching questions found.",
        questions: data.questions ?? [],
      };

      setTurns((prev) => [...prev, assistantTurn]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: "Something went wrong while searching the question bank. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-1 py-4">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="h-7 w-7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3.75h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 15 21.75H9a2.25 2.25 0 0 1-2.25-2.25V6A2.25 2.25 0 0 1 9 3.75Z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.25h4.5M9.75 12h4.5M9.75 15.75h2.25" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Search your Question Bank
              </h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Ask in Bangla or English. I only search your existing questions —
                I never make anything up.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <ChatMessage key={turn.id} turn={turn} />
        ))}

        {loading && <LoadingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="pt-2">
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
