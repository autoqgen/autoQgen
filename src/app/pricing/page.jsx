"use client";

import { FaCheck } from "react-icons/fa";

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gray-50 py-20 px-6">

      {/* HEADER */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
          Simple Pricing
        </h1>
        <p className="text-gray-500 mt-4">
          Choose the plan that fits your institution
        </p>
      </div>

      {/* PRICING GRID */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">

        {/* BASIC */}
        <div className="bg-white p-8 rounded-2xl shadow hover:shadow-lg transition">
          <h2 className="text-xl font-semibold mb-2">Basic</h2>
          <p className="text-gray-500 mb-6">For small use</p>

          <div className="text-4xl font-bold mb-6">
            $0 <span className="text-sm text-gray-400">/month</span>
          </div>

          <ul className="space-y-3 text-gray-600 mb-8">
            <li className="flex items-center gap-2"><FaCheck className="text-green-500"/> Create questions</li>
            <li className="flex items-center gap-2"><FaCheck className="text-green-500"/> Basic export</li>
            <li className="flex items-center gap-2"><FaCheck className="text-green-500"/> Limited storage</li>
          </ul>

          <button className="w-full py-2 rounded-lg border border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white transition">
            Get Started
          </button>
        </div>

        {/* PRO */}
        <div className="bg-purple-600 text-white p-8 rounded-2xl shadow-lg scale-105">
          <h2 className="text-xl font-semibold mb-2">Pro</h2>
          <p className="text-purple-100 mb-6">For teachers & schools</p>

          <div className="text-4xl font-bold mb-6">
            $9 <span className="text-sm text-purple-200">/month</span>
          </div>

          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-2"><FaCheck /> Unlimited questions</li>
            <li className="flex items-center gap-2"><FaCheck /> PDF export</li>
            <li className="flex items-center gap-2"><FaCheck /> Exam builder</li>
            <li className="flex items-center gap-2"><FaCheck /> Priority support</li>
          </ul>

          <button className="w-full py-2 rounded-lg bg-white text-purple-600 font-semibold hover:bg-gray-100 transition">
            Get Pro
          </button>
        </div>

        {/* ENTERPRISE */}
        <div className="bg-white p-8 rounded-2xl shadow hover:shadow-lg transition">
          <h2 className="text-xl font-semibold mb-2">Enterprise</h2>
          <p className="text-gray-500 mb-6">For institutions</p>

          <div className="text-4xl font-bold mb-6">
            Custom
          </div>

          <ul className="space-y-3 text-gray-600 mb-8">
            <li className="flex items-center gap-2"><FaCheck className="text-green-500"/> Full system access</li>
            <li className="flex items-center gap-2"><FaCheck className="text-green-500"/> Team management</li>
            <li className="flex items-center gap-2"><FaCheck className="text-green-500"/> Dedicated support</li>
          </ul>

          <button className="w-full py-2 rounded-lg border border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white transition">
            Contact Us
          </button>
        </div>

      </div>
    </div>
  );
}