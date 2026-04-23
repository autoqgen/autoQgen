import {
  BookOpen,
  ClipboardList,
  CheckCircle,
  Download
} from "lucide-react";

export default function HowItWorks() {
  return (
    <section className="py-24 bg-gray-50 text-center">

      {/* Title */}
      <h2 className="text-3xl md:text-4xl font-bold mb-4 text-purple-700">
        How It Works
      </h2>

      {/* Subtitle */}
      <p className="text-gray-600 max-w-2xl mx-auto mb-14 px-4">
        Create professional question papers in just 4 simple steps — from selecting subjects to downloading ready-to-print PDFs.
      </p>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto px-4">

        {/* Step 1 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition flex flex-col items-center text-center">
          <div className="bg-purple-100 p-3 rounded-xl mb-4">
            <BookOpen className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-purple-700">1. Select Program</h3>
          <p className="text-sm text-gray-600">
            Choose your exam type, class, or academic program to start building your question set.
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition flex flex-col items-center text-center">
          <div className="bg-purple-100 p-3 rounded-xl mb-4">
            <ClipboardList className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-purple-700">2. Choose Subject</h3>
          <p className="text-sm text-gray-600">
            Filter by subject, chapter, exam year, and topic to refine your question pool.
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition flex flex-col items-center text-center">
          <div className="bg-purple-100 p-3 rounded-xl mb-4">
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-purple-700">3. Pick Questions</h3>
          <p className="text-sm text-gray-600">
            Select MCQs or written questions, review answers, and build your final exam set.
          </p>
        </div>

        {/* Step 4 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-lg transition flex flex-col items-center text-center">
          <div className="bg-purple-100 p-3 rounded-xl mb-4">
            <Download className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-purple-700">4. Download PDF</h3>
          <p className="text-sm text-gray-600">
            Export a fully formatted, print-ready question paper in PDF format instantly.
          </p>
        </div>

      </div>
    </section>
  );
}