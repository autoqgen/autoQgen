import type { Metadata } from "next";
import { Suspense } from "react";

import VerifyEmailPageContent from "@/components/auth/VerifyEmailPageContent";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}