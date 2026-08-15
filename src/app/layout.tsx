import type { Metadata } from "next";
import type { ReactNode } from "react";

import Providers from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AutoQgen",
    template: "%s · AutoQgen",
  },
  description: "Question bank and exam management for teachers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
