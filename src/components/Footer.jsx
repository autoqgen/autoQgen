"use client";

import {
  FaFacebookF,
  FaTwitter,
  FaGithub,
  FaLinkedinIn,
  FaFileAlt,
  FaPen,
} from "react-icons/fa";

export default function Footer() {
  const footerLinks = {
    platform: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Question Bank", href: "/questions" },
      { name: "Create Questions", href: "/create-question" },
      { name: "Exams", href: "/exams" },
    ],
    features: [
      { name: "AI Question Generator", href: "#" },
      { name: "Smart Filtering", href: "#" },
      { name: "PDF Export", href: "#" },
      { name: "Exam Builder", href: "#" },
    ],
    support: [
      { name: "FAQ", href: "#" },
      { name: "Help Center", href: "#" },
      { name: "Contact Support", href: "#" },
      { name: "Documentation", href: "#" },
    ],
  
  };

  const socialLinks = [
    { icon: <FaFacebookF />, href: "#" },
    { icon: <FaTwitter />, href: "#" },
    { icon: <FaGithub />, href: "#" },
    { icon: <FaLinkedinIn />, href: "#" },
  ];

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-14">

        {/* TOP SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* BRAND */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">

              {/* LOGO ICON (QUESTION PAPER THEME) */}
              <FaFileAlt className="text-indigo-400 text-2xl" />

              {/* SMALL PEN ICON FOR "CREATION" */}
              <FaPen className="text-yellow-400 text-lg -ml-1" />

              {/* LOGO NAME */}
              <h1 className="text-2xl font-bold text-indigo-400">
                AutoQgen
              </h1>
            </div>

            <p className="text-gray-400 mt-4 text-sm leading-relaxed max-w-md">
              AutoQgen is a smart question paper generation system for teachers
              and institutions. Create, manage, and export exams in seconds with
              AI-powered tools.
            </p>

            <button className="mt-5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm transition">
              Contact Support
            </button>
          </div>

          {/* LINKS */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-white font-semibold mb-4 capitalize">
                {title}
              </h3>

              <ul className="space-y-3 text-sm text-gray-400">
                {links.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.href}
                      className="hover:text-white transition"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* BOTTOM BAR */}
        <div className="border-t border-gray-800 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">

          <p className="text-gray-500 text-sm text-center md:text-left">
            © {new Date().getFullYear()} AutoQgen. All rights reserved.
          </p>

          {/* SOCIAL ICONS */}
          <div className="flex items-center gap-4">
            {socialLinks.map((item, i) => (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-indigo-600 transition text-gray-400 hover:text-white"
              >
                {item.icon}
              </a>
            ))}
          </div>

        </div>
      </div>
    </footer>
  );
}