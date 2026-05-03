"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";
import { signIn } from "next-auth/react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    console.log("🚀 SIGNUP START");

    if (!email || !password || !name) {
      setMessage("Please fill all required fields.");
      console.log("❌ Missing fields");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      console.log("❌ Password mismatch");
      return;
    }

    setLoading(true);

    try {
      console.log("📡 Calling API /api/auth/register");

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      console.log("📥 Response Status:", res.status);

      const data = await res.json();

      console.log("📦 Response Data:", data);

      if (!res.ok) {
        setMessage(data.message || "Signup failed");
        console.log("❌ API ERROR:", data.message);
        return;
      }

      console.log("✅ SIGNUP SUCCESS");

      setMessage("Account created successfully ✅");

      setTimeout(() => {
        console.log("🔁 Redirecting to login...");
        window.location.href = "/auth/login";
      }, 1000);
    } catch (err) {
      console.log("🔥 ERROR:", err);
      setMessage("Server error. Try again.");
    } finally {
      setLoading(false);
      console.log("🏁 SIGNUP END");
    }
  };

  const handleGoogle = () => {
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className={styles.split}>
      <div className={styles.left}>
        <img
          src="/images/auth-hero.png"
          alt="Exam Mastery"
          className={styles.heroImage}
        />
      </div>

      <div className={styles.right}>
        <div className={styles.card}>
          <h2 className={styles.title}>Create your AutoQgen account</h2>
          <p className={styles.subtitle}>Start building your question bank</p>

          <div className={styles.socialContainer} style={{ marginTop: 12 }}>
            <button
              type="button"
              className={styles.googleButton}
              onClick={handleGoogle}
            >
              Continue with Google
            </button>
          </div>

          <div className={styles.divider}>
            <span>Or create an account with email</span>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              className={styles.input}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {message && <div className={styles.message}>{message}</div>}

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create account"}
              </button>

              <Link href="/auth/login" className={styles.secondaryLink}>
                Already have an account?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
