"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

interface RegisteredUser {
  id: string;
  email: string;
  emailVerified: string | null;
}

export default function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setLoading(true);

    const result = await apiFetch<RegisteredUser>("/api/auth/register", {
      method: "POST",
      json: form,
    });

    setLoading(false);

    if (!result.success) {
      setErrors(fieldErrors(result));
      setMessage(result.error.message);
      toast.error(result.error.message);
      return;
    }

    if (result.data.emailVerified) {
      toast.success("Account created. You can now sign in.");
      toast.flash("Account created. You can now sign in.", { type: "success" });
      router.push(`/login?email=${encodeURIComponent(form.email)}&registered=1`);
    } else {
      toast.success("Account created. Check your email to verify it before signing in.");
      toast.flash("Account created. Check your email to verify it before signing in.", {
        type: "success",
      });
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}&sentAt=${Date.now()}`);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Create an account</h1>
      <p className="mt-1 text-sm text-slate-500">
        New accounts start as a basic member. Join an organization to unlock more, or ask an
        administrator to assign a role.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {message ? <Alert tone="error">{message}</Alert> : null}

        <Field label="Full name" error={errors.name} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Email" error={errors.email} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
            />
          )}
        </Field>

        <Field
          label="Password"
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
              name="new-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              required
            />
          )}
        </Field>
        <PasswordStrength password={form.password} />

        <Field label="Confirm password" error={errors.confirmPassword} required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => update("confirmPassword", event.target.value)}
              required
            />
          )}
        </Field>

        <Button type="submit" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
