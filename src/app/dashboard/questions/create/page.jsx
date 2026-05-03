"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";

export default function CreateQuestionPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blur Background */}
      <div
        onClick={() => router.back()}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      ></div>

      {/* Modal */}
      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h1 className="text-2xl font-bold text-black">
              Create New Question
            </h1>

            <p className="text-sm text-gray-700 mt-1">
              Fill in the details to create a new question.
            </p>
          </div>

          <button
            onClick={() => router.back()}
            className="text-gray-700 hover:text-black transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* Question Name */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Question / Exam Name *
            </label>

            <input
              type="text"
              placeholder="Model Test"
              className="w-full border-2 border-purple-500 rounded-xl px-4 py-3 outline-none text-black placeholder:text-gray-500"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Language
            </label>

            <select className="w-full border border-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white">
              <option>English</option>
              <option>Bangla</option>
              <option>Arabic</option>
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Class
            </label>

            <select className="w-full border border-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white">
              <option>Select Class</option>
              <option>Class 6</option>
              <option>Class 7</option>
              <option>Class 8</option>
              <option>Class 9</option>
              <option>Class 10</option>
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Topic
            </label>

            <select className="w-full border border-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white">
              <option>Select Topic</option>
              <option>Math</option>
              <option>Science</option>
              <option>English Grammar</option>
              <option>ICT</option>
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Difficulty Level
            </label>

            <select className="w-full border border-gray-400 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-black mb-2">
              Tags
            </label>

            <button className="w-full border border-dashed border-gray-400 rounded-xl py-4 text-gray-700 hover:bg-gray-50 transition">
              + Add Tag
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t bg-gray-50">
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-gray-400 rounded-xl text-black hover:bg-gray-100 transition"
          >
            Cancel
          </button>


<Link
  href="/dashboard/questions/show"
  className="bg-linear-to-r from-fuchsia-500 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition inline-block text-center"
>
  Next
</Link>
        </div>
      </div>
    </div>
  );
}