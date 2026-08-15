"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, TextInput } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await apiFetch<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      json: { email },
    });

    setLoading(false);

    if (!result.success) {
      // Only transport/validation failures reach here. A non-existent account
      // still yields success, by design.
      setError(result.error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
        <div className="mt-4">
          <Alert tone="success">
            If an account exists for that email, reset instructions have been sent. The link expires
            in one hour.
          </Alert>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we will send a reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="Email" required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          )}
        </Field>

        <Button type="submit" loading={loading}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/login" className="text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
