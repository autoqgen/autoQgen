"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, TextInput } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setLoading(true);

    const result = await apiFetch<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      json: { token, password, confirmPassword },
    });

    setLoading(false);

    if (!result.success) {
      setErrors(fieldErrors(result));
      setMessage(result.error.message);
      return;
    }

    router.push("/login?reset=1");
  }

  if (!token) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Invalid reset link</h1>
        <div className="mt-4">
          <Alert tone="error">
            This link is missing its token. Request a new reset email.
          </Alert>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/forgot" className="text-brand-700 hover:underline">
            Request a new link
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-500">
        You will be signed out of all devices after changing it.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {message ? <Alert tone="error">{message}</Alert> : null}

        <Field
          label="New password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          required
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Confirm new password" error={errors.confirmPassword} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          )}
        </Field>

        <Button type="submit" loading={loading}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
