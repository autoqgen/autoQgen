import type { Metadata } from "next";
import { SolutionsLayout } from "@/components/marketing/MarketingLayouts";
import { PublicShell } from "@/components/marketing/PublicPage";
export const metadata: Metadata = { title: "Solutions", description: "See how teachers, coaching centres, schools, colleges, and exam setters can use AutoQgen." };
export default function SolutionsPage() { return <PublicShell><SolutionsLayout /></PublicShell>; }