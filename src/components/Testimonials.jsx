import { Star, Quote } from "lucide-react";

export default function Testimonials() {
  return (
    <section className="py-24 bg-purple-100 text-center">

      {/* Title */}
      <h2 className="text-3xl md:text-4xl font-bold mb-4 text-black">
        What Teachers Say
      </h2>

      {/* Subtitle */}
      <p className="text-gray-600 max-w-2xl mx-auto mb-14 px-4">
        Trusted by educators for fast, accurate, and structured exam paper generation.
      </p>

      {/* Grid */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">

        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="relative bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition text-left flex flex-col gap-4"
          >

            {/* Quote icon */}
            <Quote className="absolute top-6 right-6 text-purple-200 w-10 h-10" />

            {/* Stars */}
            <div className="flex gap-1 text-yellow-400">
              <Star className="w-5 h-5 fill-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400" />
              <Star className="w-5 h-5 fill-yellow-400" />
            </div>

            {/* Testimonial text */}
            <p className="text-gray-600 leading-relaxed">
              “AutoQgen has completely changed how I prepare exam papers. It saves hours of manual work and gives perfectly structured output every time.”
            </p>

            {/* Divider */}
            <div className="w-full h-px bg-gray-100"></div>

            {/* Author */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                T{item}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  Teacher {item}
                </h4>
                <p className="text-sm text-gray-500">
                  College Instructor
                </p>
              </div>
            </div>

          </div>
        ))}

      </div>
    </section>
  );
}