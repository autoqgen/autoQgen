"use client";

import { signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Alert, Badge, Button, Card, Field, TextInput } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

/**
 * Real profile management.
 *
 * The previous settings screen was entirely mock state, complete with a
 * hardcoded phone number, a hardcoded email and a fixed UUID committed to the
 * repository, and its "Save Password" button called a no-op handler.
 */
export default function ProfileSettings({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordMessage, setPasswordMessage] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");
    setSavingProfile(true);

    const result = await apiFetch<Profile>("/api/users/me", { method: "PUT", json: { name } });

    setSavingProfile(false);

    if (!result.success) {
      setProfileError(result.error.message);
      return;
    }

    setProfileMessage("Profile updated.");
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordErrors({});
    setPasswordMessage("");
    setSavingPassword(true);

    const result = await apiFetch<{ message: string }>("/api/users/me/password", {
      method: "PUT",
      json: passwords,
    });

    setSavingPassword(false);

    if (!result.success) {
      setPasswordErrors(fieldErrors(result));
      setPasswordMessage(result.error.message);
      return;
    }

    // Changing the password revokes every existing session, this one included.
    setPasswordMessage("Password updated. Signing you out…");
    setTimeout(() => signOut({ callbackUrl: "/login" }), 1200);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Your account details and password.</p>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Account</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="text-sm text-slate-800">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Role</dt>
            <dd className="text-sm">
              <Badge tone="brand">{profile.role.replace(/_/g, " ")}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="text-sm">
              <Badge tone={profile.status === "active" ? "green" : "amber"}>{profile.status}</Badge>
            </dd>
          </div>
        </dl>

        <form onSubmit={handleProfile} className="mt-6 flex flex-col gap-4" noValidate>
          {profileError ? <Alert tone="error">{profileError}</Alert> : null}
          {profileMessage ? <Alert tone="success">{profileMessage}</Alert> : null}

          <Field label="Display name" required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            )}
          </Field>

          <div>
            <Button type="submit" loading={savingProfile}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Change password</h2>

        <form onSubmit={handlePassword} className="mt-4 flex flex-col gap-4" noValidate>
          {passwordMessage ? (
            <Alert tone={passwordMessage.startsWith("Password updated") ? "success" : "error"}>
              {passwordMessage}
            </Alert>
          ) : null}

          <Field label="Current password" error={passwordErrors.currentPassword} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(event) =>
                  setPasswords((previous) => ({ ...previous, currentPassword: event.target.value }))
                }
                required
              />
            )}
          </Field>

          <Field
            label="New password"
            error={passwordErrors.newPassword}
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
                value={passwords.newPassword}
                onChange={(event) =>
                  setPasswords((previous) => ({ ...previous, newPassword: event.target.value }))
                }
                required
              />
            )}
          </Field>

          <Field label="Confirm new password" error={passwordErrors.confirmPassword} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={(event) =>
                  setPasswords((previous) => ({ ...previous, confirmPassword: event.target.value }))
                }
                required
              />
            )}
          </Field>

          <div>
            <Button type="submit" loading={savingPassword}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
