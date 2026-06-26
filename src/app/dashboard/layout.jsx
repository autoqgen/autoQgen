"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import {
  LayoutDashboard,
  FileQuestion,
  PlusCircle,
  BookOpen,
  CreditCard,
  Settings,
  Bell,
  Search,
  UserCircle2,
} from "lucide-react";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  // Not logged in
  if (status === "unauthenticated") {
    return null;
  }

  const menus = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    {
      name: "Create Question",
      path: "/dashboard/questions/create",
      icon: <PlusCircle size={20} />,
    },
    {
      name: "Exams",
      path: "/dashboard/exam",
      icon: <FileQuestion size={20} />,
    },
    {
      name: "Tutorials",
      path: "/dashboard/tutorial",
      icon: <BookOpen size={20} />,
    },
    {
      name: "Subscriptions",
      path: "/dashboard/subscription",
      icon: <CreditCard size={20} />,
    },
    {
      name: "Settings",
      path: "/dashboard/settings",
      icon: <Settings size={20} />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      {/* Sidebar */}
      <div className="w-70 bg-white border-r shadow-sm flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-r from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                A
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-800">AutoQGen</h1>
                <p className="text-sm text-gray-500">Question Generator</p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="p-4 space-y-3">
            {menus.map((menu, index) => (
              <Link
                key={index}
                href={menu.path}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${
                  pathname === menu.path
                    ? "bg-linear-to-r from-fuchsia-500 to-purple-600 text-white shadow-lg"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {menu.icon}
                <span className="font-medium">{menu.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom Profile */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 bg-gray-100 p-3 rounded-2xl">
            <UserCircle2 size={45} className="text-purple-600" />

            <div>
              <h2 className="font-semibold text-gray-800">
                {session?.user?.name || "User"}
              </h2>
              <p className="text-sm text-gray-500">
                {session?.user?.email || ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <div className="bg-white border-b px-8 py-5 flex items-center justify-between shadow-sm">
          {/* Left */}
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-gray-500 mt-1">
              Welcome back, {session?.user?.name?.split(" ")[0] || "User"} 👋
            </p>
          </div>

          {/* Right */}
          <div className="flex items-center gap-5">
            {/* Search */}
            <div className="flex items-center bg-gray-100 px-4 py-3 rounded-2xl w-75">
              <Search size={18} className="text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent outline-none ml-3 w-full"
              />
            </div>

            {/* Notification */}
            <button className="relative bg-gray-100 p-3 rounded-2xl hover:bg-gray-200 transition">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Button */}
            <Link
              href="/dashboard/questions/create"
              className="bg-linear-to-r from-fuchsia-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg hover:scale-105 transition"
            >
              + Create Question
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
