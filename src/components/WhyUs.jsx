import {
  Database,
  Clock,
  Filter,
  FileText
} from "lucide-react";

export default function WhyUs() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16 md:py-24 text-center bg-white">

      {/* Label */}
      <h3 className="text-purple-600 font-medium mb-3 text-sm md:text-base">
        Why AutoQgen?
      </h3>

      {/* Title */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-12 md:mb-16 leading-snug">
        Smarter Question Paper Generation System
      </h2>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">

        {/* Card 1 */}
        <div className="bg-gray-50 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition text-left flex flex-col gap-4">

          <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center">
            <Database className="text-purple-600 w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Central Question Bank
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Store, manage, and organize all exam questions in one structured system.
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-gray-50 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition text-left flex flex-col gap-4">

          <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center">
            <Clock className="text-purple-600 w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Save Preparation Time
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Generate complete question papers in minutes instead of manual work.
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-gray-50 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition text-left flex flex-col gap-4">

          <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center">
            <Filter className="text-purple-600 w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Smart Filtering System
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Filter questions by subject, chapter, exam type, year, and difficulty.
            </p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-gray-50 p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition text-left flex flex-col gap-4">

          <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center">
            <FileText className="text-purple-600 w-6 h-6" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instant PDF Export
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Download fully formatted, print-ready exam papers instantly.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}