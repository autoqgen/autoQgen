"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut as logout } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

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
  ChevronUp,
  ChevronDown,
  Building2,
  LogOut,
} from "lucide-react";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  // Close profile popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        <div className="p-4 border-t relative" ref={profileMenuRef}>
          {/* Popover Menu */}
          {isProfileOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-purple-100 rounded-2xl shadow-xl z-50 p-4 transition-all duration-200 ease-out transform scale-100 origin-bottom">
              {/* Organization Item */}
              <div 
                onClick={() => {
                  router.push("/dashboard/settings");
                  setIsProfileOpen(false);
                }}
                className="flex items-center justify-between bg-purple-50/50 hover:bg-purple-50 p-3 rounded-xl transition duration-200 group cursor-pointer border border-purple-100/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={16} className="text-purple-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-700 truncate">
                    {session?.user?.name ? `${session.user.name}'s Organization` : "My Organization"}
                  </span>
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/dashboard/settings");
                    setIsProfileOpen(false);
                  }}
                  className="text-purple-500 hover:text-purple-700 p-1 rounded-lg hover:bg-purple-100/60 transition duration-200"
                  title="Settings"
                >
                  <Settings size={15} className="group-hover:rotate-45 transition-transform duration-300" />
                </button>
              </div>
              
              {/* Divider */}
              <div className="h-[1px] bg-gray-100 my-3" />
              
              {/* Log Out Option */}
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  logout({ callbackUrl: "/auth/login" });
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-gray-700 hover:bg-red-50 hover:text-red-600 transition duration-200 text-left font-medium cursor-pointer"
              >
                <LogOut size={16} className="text-gray-500 group-hover:text-red-600" />
                <span className="text-sm">Log Out</span>
              </button>
            </div>
          )}

          {/* Trigger Button */}
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition duration-200 cursor-pointer ${
              isProfileOpen 
                ? "bg-purple-50/30 border-purple-200" 
                : "border-gray-100 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3 text-left min-w-0">
              <UserCircle2 size={36} className="text-purple-600 flex-shrink-0" />
              <div className="truncate">
                <h2 className="font-semibold text-gray-800 text-sm truncate">
                  {session?.user?.name || "User"}
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.email || ""}
                </p>
              </div>
            </div>
            {isProfileOpen ? (
              <ChevronDown size={16} className="text-gray-400 flex-shrink-0 ml-1" />
            ) : (
              <ChevronUp size={16} className="text-gray-400 flex-shrink-0 ml-1" />
            )}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <div className="bg-white border-b px-8 py-5 flex items-center justify-between shadow-sm">
          {/* Left */}
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {pathname === "/dashboard/settings" ? "Settings" :
               pathname === "/dashboard/exam" ? "Exams" :
               pathname === "/dashboard/tutorial" ? "Tutorials" :
               pathname === "/dashboard/subscription" ? "Subscriptions" :
               pathname === "/dashboard/questions/create" ? "Create Question" : "Dashboard"}
            </h1>
            <p className="text-gray-500 mt-1">
              {pathname === "/dashboard/settings" ? "Configure your account preferences" :
               pathname === "/dashboard/exam" ? "Manage and review exams" :
               pathname === "/dashboard/tutorial" ? "Learn how to get the most out of AutoQGen" :
               pathname === "/dashboard/subscription" ? "Manage your current plan and usage" :
               pathname === "/dashboard/questions/create" ? "Generate questions using AI or manual tools" :
               `Welcome back, ${session?.user?.name?.split(" ")[0] || "User"} 👋`}
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
