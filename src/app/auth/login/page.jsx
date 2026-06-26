"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "../auth.module.css";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      setMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setMessage("Login Failed ❌");
        return;
      }

      setMessage("Login Successful ✅");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className={styles.split}>
      <div className={styles.left}>
        <img
          src="/images/auth-hero.png"
          alt="AutoQgen"
          className={styles.heroImage}
        />
      </div>

      <div className={styles.right}>
        <div className={styles.card}>
          <h2 className={styles.title}>Sign in to AutoQgen</h2>
          <p className={styles.subtitle}>Access your question bank</p>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/auth/forgot" className={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>

          <div className={styles.socialContainer}>
            <button
              type="button"
              className={styles.googleButton}
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              Continue with Google
            </button>
          </div>

          <div className={styles.divider}>
            <span>Or continue with email</span>
          </div>

          <div className={styles.form}>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />

            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />

            {message && (
              <div
                style={{
                  padding: "10px",
                  marginTop: "8px",
                  borderRadius: "6px",
                  backgroundColor: message.includes("✅")
                    ? "#d4edda"
                    : "#f8d7da",
                  color: message.includes("✅") ? "#155724" : "#721c24",
                  border: message.includes("✅")
                    ? "1px solid #c3e6cb"
                    : "1px solid #f5c6cb",
                  fontSize: "14px",
                }}
              >
                {message}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <Link href="/auth/signup" className={styles.secondaryLink}>
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
