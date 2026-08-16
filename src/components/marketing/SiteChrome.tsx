import Link from "next/link";

import { UserProfileDropdown } from "@/components/ui";

export function SiteHeader({
  isLoggedIn = false,
  user,
}: {
  isLoggedIn?: boolean;
  user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null } | null;
}) {
  const plainUser = user
    ? { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null, role: user.role ?? null }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-slate-900 hover:text-brand-700 transition">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white font-extrabold text-sm shadow-xs">AQ</span>
          <span>AutoQgen</span>
        </Link>
        <nav className="flex items-center gap-3">
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
              >
                Go to Dashboard
              </Link>
              <UserProfileDropdown user={plainUser} dropDirection="down" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
              >
                Create an account
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <footer className="border-t border-slate-200 py-10">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
        <span>© {new Date().getFullYear()} AutoQgen</span>
        <div className="flex items-center gap-6">
          {isLoggedIn ? (
            <Link href="/dashboard" className="font-medium transition hover:text-slate-800">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="transition hover:text-slate-800">
                Sign in
              </Link>
              <Link href="/register" className="transition hover:text-slate-800">
                Create an account
              </Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
