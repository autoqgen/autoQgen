import { HelpCircle } from "lucide-react";

export default function FAQ() {
  return (
    <section className="py-24 bg-gray-50">

      {/* Title */}
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-black">
        Frequently Asked Questions
      </h2>

      {/* Subtitle */}
      <p className="text-gray-600 text-center max-w-2xl mx-auto mb-14 px-4">
        Everything you need to know about using AutoQgen for creating exam papers.
      </p>

      {/* FAQ Container */}
      <div className="max-w-3xl mx-auto px-4 space-y-5">

        {[
          {
            q: "Is AutoQgen free to use?",
            a: "Yes, basic features are completely free for teachers and institutions."
          },
          {
            q: "Can I export question papers as PDF?",
            a: "Yes, you can generate and download fully formatted printable PDF exam papers."
          },
          {
            q: "Do I need to log in to use the system?",
            a: "Yes, login is required to save questions, manage exams, and access dashboard features."
          }
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition p-6"
          >

            {/* Question */}
            <div className="flex items-start gap-3 font-semibold text-gray-900 mb-3">
              <HelpCircle className="w-5 h-5 text-indigo-600 mt-1" />
              <h3>{item.q}</h3>
            </div>

            {/* Answer */}
            <p className="text-gray-600 leading-relaxed pl-8">
              {item.a}
            </p>

          </div>
        ))}

      </div>
    </section>
  );
}