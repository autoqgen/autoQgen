"use client";

import { useEffect, useState } from "react";

import {
  getCategories,
  getSubjects,
  getChapters,
} from "../services/api";

import { Category, Subject, Chapter } from "../types";

interface Props {
  onSearch: (filters: {
    category: string;
    subject: string;
    chapter: string;
    type: string;
  }) => void;
}

export default function QuestionFilter({ onSearch }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [type, setType] = useState("MCQ");

  /* ===========================
     Load Categories
  =========================== */

  useEffect(() => {
    async function load() {
      try {
        const res = await getCategories();
        setCategories(res.data || []);
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, []);

  /* ===========================
     Load Subjects
  =========================== */

  useEffect(() => {
    if (!category) {
      setSubjects([]);
      setSubject("");
      return;
    }

    async function load() {
      try {
        const res = await getSubjects(category);

        setSubjects(res.data || []);
        setSubject("");
        setChapter("");
        setChapters([]);
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, [category]);

  /* ===========================
     Load Chapters
  =========================== */

  useEffect(() => {
    if (!subject) {
      setChapters([]);
      setChapter("");
      return;
    }

    async function load() {
      try {
        const res = await getChapters(subject);

        setChapters(res.data || []);
        setChapter("");
      } catch (error) {
        console.error(error);
      }
    }

    load();
  }, [subject]);

  return (
    <div className="bg-white rounded-2xl shadow border p-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Category */}

        <div>
          <label className="block mb-2 font-medium">
            Category *
          </label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Select Category</option>

            {categories.map((item) => (
              <option
                key={item._id}
                value={item._id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}

        <div>
          <label className="block mb-2 font-medium">
            Subject *
          </label>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Select Subject</option>

            {subjects.map((item) => (
              <option
                key={item._id}
                value={item._id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chapter */}

        <div>
          <label className="block mb-2 font-medium">
            Chapter *
          </label>

          <select
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Select Chapter</option>

            {chapters.map((item) => (
              <option
                key={item._id}
                value={item._id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Question Type */}

        <div>
          <label className="block mb-2 font-medium">
            Question Type *
          </label>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border rounded-xl p-3"
          >
            <option value="MCQ">MCQ</option>
            <option value="MULTIPLE_CORRECT">
              Multiple Correct
            </option>
            <option value="TRUE_FALSE">
              True / False
            </option>
            <option value="FILL_BLANK">
              Fill Blank
            </option>
            <option value="SHORT">
              Short
            </option>
            <option value="WRITTEN">
              Written
            </option>
          </select>
        </div>

      </div>

      <div className="mt-6">

        <button
          onClick={() =>
            onSearch({
              category,
              subject,
              chapter,
              type,
            })
          }
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl"
        >
          Get Questions
        </button>

      </div>

    </div>
  );
}