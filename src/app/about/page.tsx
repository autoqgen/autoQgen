import type { Metadata } from "next";
import { AboutLayout } from "@/components/marketing/MarketingLayouts";
import { PublicShell } from "@/components/marketing/PublicPage";
export const metadata: Metadata = { title: "About", description: "Learn what AutoQgen is built to help question setters do." };
export default function AboutPage() { return <PublicShell><AboutLayout /></PublicShell>; }