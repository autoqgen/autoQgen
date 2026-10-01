import type { Metadata } from "next";
import type { ReactNode } from "react";

import Providers from "@/app/providers";
import { themeInitScript } from "@/lib/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AutoQgen",
    template: "%s · AutoQgen",
  },
  description: "Question bank and exam management for teachers.",
  robots: { index: true, follow: true },
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
