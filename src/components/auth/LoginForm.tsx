"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, TextInput, useToast } from "@/components/ui";
import { EMAIL_NOT_VERIFIED_ERROR } from "@/lib/auth/messages";

export default function LoginForm({
  googleEnabled,
  showSeedHint = false,
}: {
  googleEnabled: boolean;
  /** DEV ONLY — renders the seed-credentials helper. Remove before production. */
  showSeedHint?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verified = searchParams.get("verified");

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
      if (errMsg === EMAIL_NOT_VERIFIED_ERROR) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}&sentAt=${Date.now()}`);
        return;
      }
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
      {verified === "1" ? <Alert tone="success">Email verified. You can now sign in.</Alert> : null}
      {verified === "0" ? <Alert tone="error">This verification link is invalid or expired.</Alert> : null}

      {/* A real <form>: the previous login screen used a bare onClick handler, so
          pressing Enter in the password field did nothing. */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {searchParams.get("registered") === "1" ? (
          <Alert tone="info">Your account was created. You can sign in now.</Alert>
        ) : null}

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

      {/* DEV ONLY — seed credentials helper. TODO: remove before production.
          Gated on `isDev` from the server page. Populated by `npm run seed:large`. */}
      {showSeedHint ? (
        <SeedCredentialsHint
          onPick={(pickedEmail) => {
            setEmail(pickedEmail);
            setPassword(SEED_PASSWORD);
          }}
        />
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  DEV ONLY — remove this whole block (and its use above) before production. */
/* -------------------------------------------------------------------------- */

const SEED_PASSWORD = "1234";

const SEED_ACCOUNTS: { label: string; email: string }[] = [
  { label: "Super Admin", email: "superadmin@demo.test" },
  { label: "Org Owner", email: "abdullahakib313@gmail.com" },
  { label: "Teacher", email: "teacher.abdullah@demo.test" },
  { label: "Reviewer", email: "reviewer1.org1@autoqgen.test" },
];

function SeedCredentialsHint({ onPick }: { onPick: (email: string) => void }) {
  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-semibold">Seed accounts (dev only — remove later)</p>
      <p className="mt-0.5 text-amber-800">
        Shared password: <code className="font-mono">{SEED_PASSWORD}</code>
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {SEED_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              onClick={() => onPick(account.email)}
              className="w-full rounded-lg px-2 py-1 text-left font-mono transition hover:bg-amber-100"
            >
              <span className="font-sans font-medium">{account.label}</span> — {account.email}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
