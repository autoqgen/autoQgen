"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

import {
  FaFileAlt,
  FaPen,
  FaUsers,
  FaClipboardList,
} from "react-icons/fa";

export default function AboutUs() {
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: false, // 🔥 re-animate every scroll
      offset: 120,
      easing: "ease-in-out",
    });

    AOS.refresh();
  }, []);

  return (
    <div className="bg-gray-50 text-gray-800">

      {/* HERO SECTION */}
      <section
        className="relative min-h-[75vh] w-full flex items-center justify-center text-center overflow-hidden"
        data-aos="fade-up"
      >

        {/* BACKGROUND */}
        <div className="absolute inset-0 bg-linear-to-br from-purple-900 via-purple-800 to-indigo-900" />

        <div className="absolute top-0 left-0 w-125 h-125 bg-purple-500/30 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-0 w-125 h-125 bg-indigo-500/30 rounded-full blur-[120px]" />

        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-linear(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-linear(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* CONTENT */}
        <div className="relative z-10 px-6 py-20 max-w-3xl mx-auto">

          {/* BADGE */}
          <div
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-8 border border-white/20"
            data-aos="zoom-in"
          >
            <span className="text-sm font-medium text-white/90">
              Smart Exam Platform
            </span>
          </div>

          {/* TITLE */}
          <h1
            className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 bg-linear-to-r from-white via-purple-200 to-white bg-clip-text text-transparent"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            AutoQgen
          </h1>

          {/* DESCRIPTION */}
          <p
            className="max-w-3xl mx-auto text-lg md:text-xl text-purple-100/90 mb-10 leading-relaxed"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            Create, organize, and generate professional question papers in minutes —
            built for teachers, schools, and institutions.
          </p>

          {/* BUTTONS */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            data-aos="zoom-in"
            data-aos-delay="300"
          >
            <button className="px-8 py-3 bg-white text-purple-900 rounded-full font-semibold hover:scale-105 transition">
              Get Started
            </button>

            <button className="px-8 py-3 border border-white/30 text-white rounded-full hover:bg-white/10 transition">
              View Demo
            </button>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-3xl mx-auto mt-16 pt-8 border-t border-white/10"
            data-aos="fade-up"
            data-aos-delay="400"
          >
            <div>
              <div className="text-2xl md:text-3xl font-bold text-white">10K+</div>
              <div className="text-sm text-purple-200">Questions Created</div>
            </div>

            <div>
              <div className="text-2xl md:text-3xl font-bold text-white">500+</div>
              <div className="text-sm text-purple-200">Active Teachers</div>
            </div>

            <div>
              <div className="text-2xl md:text-3xl font-bold text-white">98%</div>
              <div className="text-sm text-purple-200">User Satisfaction</div>
            </div>
          </div>

        </div>
      </section>

      {/* ABOUT SECTION */}
      <section
        className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center"
        data-aos="fade-up"
      >
        <div data-aos="fade-right">
          <h2 className="text-3xl font-bold mb-4">Who We Are</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            AutoQgen is built to make exam preparation faster, easier, and more
            organized. We help educators create structured question papers
            without manual formatting.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Our goal is to provide consistency and efficiency in every exam paper.
          </p>
        </div>

        <div
          className="bg-white p-8 rounded-2xl shadow-lg"
          data-aos="fade-left"
        >
          <FaFileAlt className="text-purple-600 text-4xl mb-4" />
          <h3 className="text-xl font-semibold mb-2">Structured Papers</h3>
          <p className="text-gray-500">
            Clean and well-organized exam formatting system.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-white py-16 px-6" data-aos="fade-up">
        <div className="max-w-6xl mx-auto text-center">

          <h2 className="text-3xl font-bold mb-10" data-aos="zoom-in">
            What We Offer
          </h2>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="p-6 rounded-xl shadow hover:shadow-lg transition"
              data-aos="fade-up"
            >
              <FaPen className="text-purple-600 text-3xl mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">Easy Creation</h3>
              <p className="text-gray-500 text-sm">
                Create and customize questions quickly.
              </p>
            </div>

            <div className="p-6 rounded-xl shadow hover:shadow-lg transition"
              data-aos="fade-up"
              data-aos-delay="100"
            >
              <FaClipboardList className="text-indigo-600 text-3xl mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">Organized Exams</h3>
              <p className="text-gray-500 text-sm">
                Manage multiple exam sets easily.
              </p>
            </div>

            <div className="p-6 rounded-xl shadow hover:shadow-lg transition"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <FaUsers className="text-green-600 text-3xl mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">For Institutions</h3>
              <p className="text-gray-500 text-sm">
                Built for schools, colleges, and coaching centers.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="bg-gray-50 py-20 px-6" data-aos="fade-up">
        <div className="max-w-6xl mx-auto">

          <h2 className="text-3xl font-bold text-center mb-16">
            How AutoQgen Works
          </h2>

          <div className="relative">

            {/* CENTER LINE */}
            <div className="absolute left-1/2 -translate-x-1/2 w-1 bg-purple-200 h-full"></div>

            {[
              {
                title: "Create Questions",
                desc: "Add and manage your question bank easily.",
              },
              {
                title: "Organize & Filter",
                desc: "Categorize questions by subject and difficulty.",
              },
              {
                title: "Build Exam Paper",
                desc: "Select questions and structure your exam.",
              },
              {
                title: "Export & Share",
                desc: "Download and distribute exam papers.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="mb-12 flex justify-between items-center w-full"
                data-aos={i % 2 === 0 ? "fade-right" : "fade-left"}
                data-aos-delay={i * 100}
              >
                <div className={`w-5/12 ${i % 2 === 0 ? "text-right pr-6" : ""}`}>
                  {i % 2 === 0 && (
                    <>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-gray-500 text-sm">{step.desc}</p>
                    </>
                  )}
                </div>

                <div className="z-10 w-10 h-10 bg-purple-600 text-white flex items-center justify-center rounded-full">
                  {i + 1}
                </div>

                <div className={`w-5/12 ${i % 2 !== 0 ? "pl-6" : ""}`}>
                  {i % 2 !== 0 && (
                    <>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-gray-500 text-sm">{step.desc}</p>
                    </>
                  )}
                </div>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="bg-indigo-600 text-white py-16 px-6 text-center"
        data-aos="zoom-in"
      >
        <h2 className="text-3xl font-bold mb-4">
          Start Creating Smarter Question Papers
        </h2>

        <button className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold">
          Get Started
        </button>
      </section>

    </div>
  );
}