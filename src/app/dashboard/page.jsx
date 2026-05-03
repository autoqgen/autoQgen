"use client";

import {
  FileQuestion,
  Layers3,
  MonitorPlay,
  TrendingUp,
} from "lucide-react";

export default function Dashboard() {
  const stats = [
    {
      title: "Total Questions",
      value: "1,250",
      icon: <FileQuestion size={28} />,
      growth: "+12%",
      bg: "from-blue-500 to-cyan-500",
    },
    {
      title: "Question Sets",
      value: "320",
      icon: <Layers3 size={28} />,
      growth: "+8%",
      bg: "from-fuchsia-500 to-purple-600",
    },
    {
      title: "Online Exams",
      value: "48",
      icon: <MonitorPlay size={28} />,
      growth: "+20%",
      bg: "from-orange-500 to-pink-500",
    },
  ];

  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">
          Dashboard Overview
        </h1>

        <p className="text-gray-500 mt-2">
          Monitor your question bank and exams.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {stats.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition duration-300 border border-gray-100"
          >
            {/* Top */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">
                  {item.title}
                </p>

                <h2 className="text-4xl font-bold mt-3 text-gray-800">
                  {item.value}
                </h2>
              </div>

              {/* Icon */}
              <div
                className={`w-16 h-16 rounded-2xl bg-linear-to-r ${item.bg} flex items-center justify-center text-white shadow-lg`}
              >
                {item.icon}
              </div>
            </div>

            {/* Bottom */}
            <div className="flex items-center gap-2 mt-6">
              <div className="flex items-center text-green-600 text-sm font-medium">
                <TrendingUp size={16} className="mr-1" />

                {item.growth}
              </div>

              <p className="text-gray-400 text-sm">
                from last month
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white mt-10 rounded-3xl shadow-sm border border-gray-100">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            Recent Question Sets
          </h2>

          <p className="text-gray-500 mt-1">
            Latest created question collections
          </p>
        </div>

        <div className="p-10 text-center text-gray-400">
          No question sets available yet.
        </div>
      </div>
    </div>
  );
}