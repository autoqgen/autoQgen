"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Button, Card, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { EMAIL_VERIFICATION_TTL_SECONDS } from "@/lib/auth/verification";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default function EmailVerificationPending({ email, sentAt }: { email: string; sentAt?: number }) {
  const toast = useToast();
  const [expiresIn, setExpiresIn] = useState(() => {
    if (!sentAt) return EMAIL_VERIFICATION_TTL_SECONDS;
    return Math.max(0, EMAIL_VERIFICATION_TTL_SECONDS - Math.floor((Date.now() - sentAt) / 1000));
  });
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setExpiresIn((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function resendVerification() {
    if (!email || expiresIn > 0 || resending) return;

    setResending(true);
    const result = await apiFetch<{ message: string }>("/api/auth/resend-verification", {
      method: "POST",
      json: { email },
    });
    setResending(false);
    if (result.success) {
      setExpiresIn(EMAIL_VERIFICATION_TTL_SECONDS);
      toast.success("A new verification email has been sent.");
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Verify your email</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        We sent a verification link to <strong>{email || "your email address"}</strong>. Verify
        your address before signing in.
      </p>

      <div className="mt-5">
        <Alert tone="info">
          {expiresIn > 0
            ? `Your verification email is valid for ${formatTime(expiresIn)}.`
            : "This verification email has expired. Request a new one below."}
        </Alert>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          loading={resending}
          disabled={!email || expiresIn > 0}
          onClick={resendVerification}
        >
          {expiresIn > 0 ? `New email available in ${formatTime(expiresIn)}` : "Send new verification email"}
        </Button>
        <p className="text-center text-xs text-slate-500">
          Check your spam folder if you do not see it. Each new link replaces the previous one.
        </p>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/login" className="text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}