import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-xl font-bold text-brand-700">
        AutoQgen
      </Link>
      <main id="main" className="w-full max-w-md">
        {children}
      </main>
    </div>
  );
}
