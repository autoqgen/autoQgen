"use client";

import { Camera, Link as LinkIcon, Trash2, Upload } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRef, useState, type FormEvent } from "react";

import { Alert, Badge, Button, Card, Field, TextInput, useToast } from "@/components/ui";
import { apiFetch, fieldErrors } from "@/lib/api/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

interface Profile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
  status: string;
}

const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/bottts/svg?seed=Teacher1",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Teacher2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Scholar",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Professor",
  "https://api.dicebear.com/7.x/identicon/svg?seed=AutoQgen",
];

export default function ProfileSettings({ profile }: { profile: Profile }) {
  const { update } = useSession();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [image, setImage] = useState(profile.image ?? "");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  const getInitials = (nameStr: string) => {
    return (
      nameStr
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .join("")
        .toUpperCase()
        .substring(0, 2) || "U"
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setImage(dataUrl);
        setImgError(false);
        toast.info("Profile picture selected. Click 'Save profile' to apply changes.");
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");
    setSavingProfile(true);

    const result = await apiFetch<Profile>("/api/users/me", {
      method: "PUT",
      json: { name, image },
    });

    setSavingProfile(false);

    if (!result.success) {
      setProfileError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    // Trigger session update live so header/sidebar avatar updates automatically
    await update({ name, image });

    setProfileMessage("Profile updated successfully.");
    toast.success("Profile updated successfully!");
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
      toast.error(result.error.message);
      return;
    }

    setPasswordMessage("Password updated. Signing you out…");
    toast.success("Password updated successfully!");
    toast.flash("Password updated successfully. Signed out.", { type: "info" });
    setTimeout(() => signOut({ callbackUrl: "/" }), 1200);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Your account details, profile picture, and password.</p>
      </header>

      <Card>
        <h2 className="text-sm font-semibold text-slate-800">Account details</h2>
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

        <form onSubmit={handleProfile} className="mt-6 flex flex-col gap-6" noValidate>
          {profileError ? <Alert tone="error">{profileError}</Alert> : null}
          {profileMessage ? <Alert tone="success">{profileMessage}</Alert> : null}

          {/* Profile Picture Section */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
            <label className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
              Profile Picture
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Avatar Preview */}
              <div className="relative group shrink-0">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-xl font-bold text-white shadow-md overflow-hidden border-2 border-white ring-2 ring-brand-500/20">
                  {image && !imgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={name}
                      className="h-full w-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    getInitials(name)
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:bg-brand-700 transition"
                  title="Upload picture"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Upload Controls */}
              <div className="flex-1 flex flex-col gap-2.5 w-full">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload Image
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                  >
                    <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                    Image URL
                  </Button>

                  {image && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setImage("");
                        setImgError(false);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-2 mt-1">
                    <TextInput
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="text-xs py-1.5"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => {
                        if (imageUrlInput.trim()) {
                          setImage(imageUrlInput.trim());
                          setImgError(false);
                          setShowUrlInput(false);
                        }
                      }}
                    >
                      Set URL
                    </Button>
                  </div>
                )}

                {/* Preset Avatars */}
                <div className="mt-1">
                  <span className="text-[11px] font-medium text-slate-500">Or pick a preset avatar:</span>
                  <div className="flex items-center gap-2 mt-1.5">
                    {PRESET_AVATARS.map((avatarUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setImage(avatarUrl);
                          setImgError(false);
                        }}
                        className={`h-8 w-8 rounded-full overflow-hidden border transition ${
                          image === avatarUrl
                            ? "border-brand-600 ring-2 ring-brand-500/30 scale-105"
                            : "border-slate-200 hover:border-brand-400"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarUrl} alt={`Preset ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

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
