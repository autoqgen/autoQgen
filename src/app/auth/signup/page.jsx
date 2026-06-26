"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "../auth.module.css";

export default function Signup() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" }); // type: "success" | "error"
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Field change handler ──────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear field-level error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Full name is required.";
    } else if (form.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters.";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email.";
    }

    if (!form.password) {
      newErrors.password = "Password is required.";
    } else if (form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMessage({ text: "", type: "" });

    if (!validate()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          text: data.message || "Signup failed. Please try again.",
          type: "error",
        });
        return;
      }

      setMessage({
        text: "Account created successfully! Redirecting to login…",
        type: "success",
      });

      setTimeout(() => {
        router.push("/auth/login");
      }, 4000);
    } catch (err) {
      console.error("Signup error:", err);
      setMessage({
        text: "Server error. Please try again later.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Google sign-in ─────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/" });
    // Loading stays true until redirect
  };

  // ── Password strength indicator ────────────────────────────────────────────
  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { label: "", color: "", width: "0%" };
    if (p.length < 6)
      return { label: "Too short", color: "#ef4444", width: "25%" };
    if (p.length < 8) return { label: "Weak", color: "#f97316", width: "40%" };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p) && p.length >= 8)
      return { label: "Strong", color: "#22c55e", width: "100%" };
    return { label: "Fair", color: "#eab308", width: "65%" };
  };

  const strength = getPasswordStrength();

  return (
    <div className={styles.split}>
      {/* ── Left hero panel ── */}
      <div className={styles.left}>
        <img
          src="/images/auth-hero.png"
          alt="AutoQgen – AI Question Generator"
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay}>
          <h1 className={styles.heroTitle}>AutoQgen</h1>
          <p className={styles.heroSubtitle}>
            AI-powered question bank builder for educators &amp; students
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className={styles.right}>
        <div className={styles.card}>
          <h2 className={styles.title}>Create your account</h2>
          <p className={styles.subtitle}>
            Start building your question bank — free forever
          </p>

          {/* Google button */}
          <div className={styles.socialContainer}>
            <button
              type="button"
              className={styles.googleButton}
              onClick={handleGoogle}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <span className={styles.btnSpinner} />
              ) : (
                <GoogleIcon />
              )}
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>
          </div>

          <div className={styles.divider}>
            <span>or sign up with email</span>
          </div>

          {/* Form */}
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                name="name"
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                placeholder="Rahim Uddin"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                disabled={loading}
              />
              {errors.name && (
                <p className={styles.fieldError}>{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
              />
              {errors.email && (
                <p className={styles.fieldError}>{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div className={styles.strengthBar}>
                  <div
                    className={styles.strengthFill}
                    style={{
                      width: strength.width,
                      backgroundColor: strength.color,
                    }}
                  />
                </div>
              )}
              {form.password && (
                <p
                  className={styles.strengthLabel}
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </p>
              )}
              {errors.password && (
                <p className={styles.fieldError}>{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="confirmPassword">
                Confirm password
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ""}`}
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className={styles.fieldError}>{errors.confirmPassword}</p>
              )}
            </div>

            {/* Message */}
            {message.text && (
              <div
                className={`${styles.message} ${
                  message.type === "success"
                    ? styles.messageSuccess
                    : styles.messageError
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <>
                  <span className={styles.btnSpinner} /> Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>

            <p className={styles.loginLink}>
              Already have an account?{" "}
              <Link href="/auth/login" className={styles.link}>
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Inline SVG icons (no extra package needed) ─────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.08-6.08C34.46 3.06 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.09 5.51C12.4 13.07 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.62-.15-3.19-.42-4.7H24v8.9h12.66c-.55 2.97-2.22 5.49-4.73 7.17l7.3 5.67C43.46 37.64 46.5 31.5 46.5 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.73 28.73A14.57 14.57 0 0 1 9.5 24c0-1.64.28-3.23.73-4.73l-7.09-5.51A23.93 23.93 0 0 0 .5 24c0 3.87.93 7.53 2.64 10.73l7.59-5.99z"
      />
      <path
        fill="#34A853"
        d="M24 47c5.5 0 10.12-1.82 13.49-4.95l-7.3-5.67c-1.82 1.22-4.15 1.95-6.19 1.95-6.26 0-11.6-3.57-13.27-8.6l-7.59 5.99C7.07 41.52 14.82 47 24 47z"
      />
    </svg>
  );
}

function Eye() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
