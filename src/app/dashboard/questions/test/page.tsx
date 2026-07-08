"use client";

import { useState } from "react";

import QuestionFilter from "./components/QuestionFilter";
import QuestionList from "./components/QuestionList";

import { getQuestions } from "./services/api";
import { Question } from "./types";

export default function QuestionTestPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(filters: {
    category: string;
    subject: string;
    chapter: string;
    type: string;
  }) {
    try {
      setLoading(true);

      const res = await getQuestions(filters);

      setQuestions(res.data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Question API Tester
        </h1>

        <p className="text-gray-500 mt-2">
          Test Question Filtering from MongoDB
        </p>
      </div>

      {/* Filter */}
      <QuestionFilter onSearch={handleSearch} />

      {/* Result */}
      <QuestionList questions={questions} loading={loading} />
    </main>
  );
}
