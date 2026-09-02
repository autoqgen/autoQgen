import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-8 text-xl font-bold text-brand-700">
        AutoQgen
      </Link>
      <main id="main" className="w-full max-w-md">
        {children}
      </main>
    </div>
  );
}
