"use client";

import {
  CheckSquare,
  Filter,
 
} from "lucide-react";

export default function CreateMCQPage() {
  const questions = [
    {
      id: 1,
      question: "What is the main function of mitochondria?",
      options: [
        "Protect the cell",
        "Produce energy",
        "Increase growth",
        "Create food",
      ],
      tags: ["Biology", "DB 2021", "SSC"],
    },
    {
      id: 2,
      question: "Which part of the plant absorbs water?",
      options: [
        "Leaf",
        "Stem",
        "Root",
        "Flower",
      ],
      tags: ["Botany", "MCQ", "Board"],
    },
  ];

  return (
    <div className="flex gap-6 p-6 bg-[#f6f7fb] min-h-screen">
      
      {/* Sidebar Filters */}
      <div className="w-75 bg-white rounded-3xl shadow-sm border border-gray-100 p-5 h-fit sticky top-5">
        
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-r from-fuchsia-500 to-purple-600 text-white flex items-center justify-center">
            <Filter size={22} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Filters
            </h2>

            <p className="text-sm text-gray-500">
              Select question category
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          
          <select className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-black outline-none focus:ring-2 focus:ring-purple-500">
            <option>SSC</option>
            <option>HSC</option>
          </select>

          <select className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-black outline-none focus:ring-2 focus:ring-purple-500">
            <option>Biology</option>
            <option>Physics</option>
            <option>Chemistry</option>
          </select>

          <select className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-black outline-none focus:ring-2 focus:ring-purple-500">
            <option>MCQ</option>
            <option>CQ</option>
          </select>

          <select className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-black outline-none focus:ring-2 focus:ring-purple-500">
            <option>Dhaka Board</option>
            <option>Rajshahi Board</option>
          </select>

          <select className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-black outline-none focus:ring-2 focus:ring-purple-500">
            <option>Select Year</option>
            <option>2021</option>
            <option>2022</option>
          </select>
        </div>
      </div>

      {/* Question Area */}
      <div className="flex-1 space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              MCQ Questions
            </h1>

            <p className="text-gray-500 mt-1">
              Select questions for your exam set
            </p>
          </div>

          <button className="bg-linear-to-r from-fuchsia-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg hover:scale-105 transition">
            Save Question Set
          </button>
        </div>

        {/* Questions */}
        {questions.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl border-2 border-fuchsia-200 shadow-sm hover:shadow-lg transition overflow-hidden"
          >
            
            {/* Top */}
            <div className="flex items-start justify-between p-6">
              
              <div className="flex gap-4">
                
                {/* Number */}
                <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-700 font-bold flex items-center justify-center text-lg">
                  {item.id}
                </div>

                {/* Content */}
                <div>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="bg-purple-100 text-purple-700 text-sm px-3 py-1 rounded-xl font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Question */}
                  <h2 className="text-xl font-semibold text-gray-900">
                    {item.question}
                  </h2>
                </div>
              </div>

              {/* Checkbox */}
              <button className="w-10 h-10 rounded-xl bg-linear-to-r from-fuchsia-500 to-purple-600 text-white flex items-center justify-center shadow">
                <CheckSquare size={20} />
              </button>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4 p-6 pt-0">
              {item.options.map((option, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-2xl px-5 py-4 text-gray-800 hover:border-purple-400 hover:bg-purple-50 transition cursor-pointer"
                >
                  <span className="font-semibold mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>

                  {option}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}