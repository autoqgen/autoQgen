"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { useToast } from "./toast";

export interface UserProfileDropdownProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  dropDirection?: "up" | "down";
  className?: string;
}

export function UserProfileDropdown({
  user: initialUser,
  dropDirection = "down",
  className = "",
}: UserProfileDropdownProps) {
  const { data: session } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentUser = {
    name: initialUser?.name ?? session?.user?.name ?? "User",
    email: initialUser?.email ?? session?.user?.email ?? "",
    role: initialUser?.role ?? (session?.user as { role?: string })?.role ?? "User",
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .join("")
        .toUpperCase()
        .substring(0, 2) || "U"
    );
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    toast.info("Signing out...");
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 sm:px-3 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-700 text-sm font-semibold text-white shadow-sm">
          {getInitials(currentUser.name)}
        </div>
        <div className="hidden sm:flex flex-col min-w-0 pr-1">
          <span className="truncate text-xs font-semibold text-slate-900 leading-tight">
            {currentUser.name}
          </span>
          <span className="truncate text-[10px] text-slate-500 capitalize">
            {currentUser.role.replace(/_/g, " ")}
          </span>
        </div>
        {dropDirection === "up" ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropDirection === "up" ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropDirection === "up" ? 8 : -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="menu"
            className={`absolute z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${
              dropDirection === "up" ? "bottom-full mb-2 left-0" : "top-full mt-2 right-0"
            }`}
          >
            <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
              {currentUser.email && (
                <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
              )}
              <span className="inline-block mt-1 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 uppercase tracking-wider">
                {currentUser.role.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                role="menuitem"
              >
                <LayoutDashboard className="h-4 w-4 text-slate-500" />
                Dashboard
              </Link>

              <Link
                href="/dashboard/questions/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                role="menuitem"
              >
                <PlusCircle className="h-4 w-4 text-slate-500" />
                New Question
              </Link>

              <Link
                href="/dashboard/papers"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                role="menuitem"
              >
                <FileText className="h-4 w-4 text-slate-500" />
                Question Papers
              </Link>

              <Link
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                role="menuitem"
              >
                <Settings className="h-4 w-4 text-slate-500" />
                Settings
              </Link>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                role="menuitem"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
