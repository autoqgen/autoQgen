import Link from "next/link";

import { Container } from "@/components/marketing/shared";
import { UserProfileDropdown } from "@/components/ui";

export function SiteHeader({
  isLoggedIn = false,
  user,
}: {
  isLoggedIn?: boolean;
  user?: { name?: string | null; email?: string | null; role?: string | null } | null;
}) {
  const plainUser = user
    ? { name: user.name ?? null, email: user.email ?? null, role: user.role ?? null }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
          AutoQgen
        </Link>
        <nav className="flex items-center gap-3">
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Go to Dashboard
              </Link>
              <UserProfileDropdown user={plainUser} dropDirection="down" />
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Create an account
              </Link>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}

export function SiteFooter({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <footer className="border-t border-slate-200 py-10">
      <Container className="flex flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
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
      </Container>
    </footer>
  );
}
