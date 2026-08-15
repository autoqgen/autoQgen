import type { Metadata } from "next";
import { Suspense } from "react";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * The reset link points here — `/reset` — and the token is read from the query
 * string. In the previous project the emailed link pointed at `/auth/reset`
 * while the page lived at `/reset`, so every reset email 404'd.
 */
export default function ResetPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
