"use client";

import { useSearchParams } from "next/navigation";

import EmailVerificationPending from "@/components/auth/EmailVerificationPending";

export default function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const parsedSentAt = Number(searchParams.get("sentAt"));
  const sentAt = Number.isFinite(parsedSentAt) && parsedSentAt > 0 ? parsedSentAt : undefined;
  return <EmailVerificationPending email={email} sentAt={sentAt} />;
}