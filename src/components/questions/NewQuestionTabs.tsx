"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import QuestionForm from "@/components/questions/QuestionForm";
import CreativeQuestionForm from "@/components/questions/CreativeQuestionForm";

interface Props {
  canReview: boolean;
}

function NewQuestionTabsContent({ canReview }: Props) {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");
  const [activeTab, setActiveTab] = useState<"standard" | "creative">(
    initialType === "cq" || initialType === "creative" ? "creative" : "standard",
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">New Question</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a standard question (MCQ, Short, etc.) or a structured Creative Question (CQ / সৃজনশীল প্রশ্ন).
          </p>
        </div>

        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("standard")}
            className={`border-b-2 px-5 py-2.5 text-sm transition-colors ${
              activeTab === "standard"
                ? "border-brand-600 font-semibold text-brand-600"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            Standard Question
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("creative")}
            className={`border-b-2 px-5 py-2.5 text-sm transition-colors ${
              activeTab === "creative"
                ? "border-brand-600 font-semibold text-brand-600"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            Creative Question (CQ) / সৃজনশীল প্রশ্ন
          </button>
        </div>
      </div>

      {activeTab === "standard" ? (
        <QuestionForm mode="create" canReview={canReview} />
      ) : (
        <CreativeQuestionForm canReview={canReview} />
      )}
    </div>
  );
}

export default function NewQuestionTabs({ canReview }: Props) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading...</div>}>
      <NewQuestionTabsContent canReview={canReview} />
    </Suspense>
  );
}
