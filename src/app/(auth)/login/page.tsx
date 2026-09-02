import type { Metadata } from "next";
import { Suspense } from "react";

import LoginForm from "@/components/auth/LoginForm";
import { Spinner } from "@/components/ui";
import { googleOAuthEnabled, isDev } from "@/lib/config/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      {/* showSeedHint: DEV ONLY seed-credentials helper — remove before production. */}
      <LoginForm googleEnabled={googleOAuthEnabled} showSeedHint={isDev} />
    </Suspense>
  );
}
