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
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { useToast } from "./toast";

export interface UserProfileDropdownProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
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
  const [imgError, setImgError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawImage = session?.user?.image || initialUser?.image || "";
  const avatarImage =
    rawImage && rawImage !== "null"
      ? rawImage.startsWith("data:") || rawImage.length > 500
        ? session?.user?.id
          ? `/api/users/${session.user.id}/avatar`
          : rawImage
        : rawImage
      : session?.user?.id
      ? `/api/users/${session.user.id}/avatar`
      : "";

  const currentUser = {
    name: session?.user?.name || initialUser?.name || "User",
    email: session?.user?.email || initialUser?.email || "",
    image: avatarImage,
    role: (session?.user as { role?: string })?.role || initialUser?.role || "User",
  };

  const [prevImg, setPrevImg] = useState(currentUser.image);
  if (currentUser.image !== prevImg) {
    setPrevImg(currentUser.image);
    setImgError(false);
  }

  // Mirrors the /admin gate in rbac.ts — only super_admin holds any of the
  // platform-admin permissions the Admin Center requires.
  const isAdmin = currentUser.role.toLowerCase() === "super_admin";

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
    toast.flash("Signed out successfully", { type: "info" });
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-card px-2.5 py-1.5 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-700 text-xs font-bold text-white shadow-xs shrink-0 overflow-hidden">
          {currentUser.image && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUser.image}
              alt={currentUser.name}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            getInitials(currentUser.name)
          )}
        </div>
        <div className="hidden sm:flex flex-col min-w-0 pr-0.5">
          <span className="truncate text-xs font-semibold text-slate-900 leading-tight">
            {currentUser.name}
          </span>
          <span className="truncate text-[10px] text-slate-500 capitalize leading-none mt-0.5">
            {currentUser.role.replace(/_/g, " ")}
          </span>
        </div>
        {dropDirection === "up" ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
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
            className={`absolute z-50 w-64 rounded-xl border border-slate-200 bg-card p-2 shadow-xl ${
              dropDirection === "up" ? "bottom-full mb-2 left-0" : "top-full mt-2 right-0"
            }`}
          >
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-sm font-bold text-white shadow-xs shrink-0 overflow-hidden">
                {currentUser.image && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.image}
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  getInitials(currentUser.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
                {currentUser.email && (
                  <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                )}
                <span className="inline-block mt-0.5 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 uppercase tracking-wider">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 transition"
                  role="menuitem"
                >
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  Admin Center
                </Link>
              )}

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
