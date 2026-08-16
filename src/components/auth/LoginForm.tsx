"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, TextInput, useToast } from "@/components/ui";

export default function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!result || result.error) {
      // The server returns one generic message for every credential failure, so
      // this screen cannot be used to discover which emails have accounts.
      const errMsg = result?.error ?? "Invalid email or password.";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    const session = await getSession();
    const username = session?.user?.name || email.split("@")[0];
    toast.flash(`Welcome, ${username}`, { type: "success" });
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Access your question bank.</p>

      {/* A real <form>: the previous login screen used a bare onClick handler, so
          pressing Enter in the password field did nothing. */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="Email" required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Password" required>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          )}
        </Field>

        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="my-5 text-center text-xs uppercase tracking-wide text-slate-400">or</div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl })}
          >
            Continue with Google
          </Button>
        </>
      ) : null}

      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-brand-700 hover:underline">
          Create an account
        </Link>
      </div>
    </Card>
  );
}
