"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaFileAlt, FaPen } from "react-icons/fa";

export default function Navbar() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return (
    <nav className="w-full bg-white shadow-md px-6 py-3 flex items-center justify-between">
      {/* LOGO */}
      <div className="flex items-center gap-2 text-xl font-bold text-purple-700">
        <FaFileAlt className="text-purple-700 text-xl" />
        <FaPen className="text-yellow-500 text-sm -ml-1" />
        <Link href="/">AutoQgen</Link>
      </div>

      {/* MENU */}
      <div className="hidden md:flex gap-6 text-gray-700">
        <Link className="hover:text-purple-800" href="/">
          Home
        </Link>
        <Link className="hover:text-purple-800" href="/aboutUs">
          About Us
        </Link>
        <Link className="hover:text-purple-800" href="/pricing">
          Pricing
        </Link>
      </div>

      {/* LOGIN BUTTON */}
      <div className="flex items-center gap-4">
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center px-4 py-2 text-base font-medium text-white bg-purple-700 border border-purple-800 rounded-md shadow-sm hover:bg-purple-800"
        >
          Login
        </Link>
      </div>
    </nav>
  );
}
