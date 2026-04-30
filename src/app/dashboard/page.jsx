"use client";

import React, { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

import { ShieldCheck, ArrowRight } from "lucide-react";

import WhyUs from "@/components/WhyUs";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";

const Dashboard = () => {
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: false,
      offset: 120,
      easing: "ease-in-out",
    });

    AOS.refresh();
  }, []);

  return (
    <div>
      {/* HERO SECTION */}
      <section
        className="relative flex flex-col items-center justify-center min-h-screen px-4 py-16 bg-white overflow-hidden"
        data-aos="fade-up"
        data-once="false"
      >
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)",
            backgroundSize: "45px 45px",
          }}
        />

        <div className="z-10 w-full max-w-7xl mx-auto text-center px-4">
          {/* BADGE */}
          <div
            className="inline-flex items-center px-4 py-1.5 mb-10 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-full border border-indigo-100 shadow-sm"
            data-aos="zoom-in"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Secure and fast question paper generation platform
          </div>

          {/* HEADING */}
          <h1
            className="mb-8 text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight text-center w-full max-w-7xl mx-auto"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Create professional <br />
            high-quality question papers in minutes
          </h1>

          {/* DESCRIPTION */}
          <p
            className="max-w-3xl mx-auto mb-12 text-lg leading-relaxed text-slate-600 md:text-xl px-4"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            From program selection to filtering and automated layout
            configuration— smart question bank management and PDF generation for
            your institution is now easier than ever.
          </p>

          {/* CTA BUTTONS */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            data-aos="zoom-in"
            data-aos-delay="300"
          >
            <button className="w-full sm:w-auto px-10 py-5 text-lg font-bold text-white transition-all transform bg-indigo-600 rounded-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-xl shadow-indigo-200 flex items-center justify-center">
              Login to Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </button>

            <button className="w-full sm:w-auto px-10 py-5 text-lg font-bold text-slate-700 transition-all bg-white border-2 border-slate-100 rounded-2xl hover:bg-slate-50">
              View Features
            </button>
          </div>
        </div>
      </section>

      {/* OTHER SECTIONS */}
      <div data-aos="fade-up">
        <WhyUs />
      </div>

      <div data-aos="fade-up" data-aos-delay="100">
        <HowItWorks />
      </div>

      <div data-aos="fade-up" data-aos-delay="200">
        <Testimonials />
      </div>

      <div data-aos="fade-up" data-aos-delay="300">
        <FAQ />
      </div>
    </div>
  );
};

export default Dashboard;
