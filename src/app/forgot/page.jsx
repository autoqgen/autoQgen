'use client';

import { useState } from "react";
import Link from "next/link";
import styles from "../auth.module.css";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!email) {
      setMessage("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setMessage("If an account exists, reset instructions were sent to the email provided.");
    } catch (err) {
      setMessage("Failed to send reset email. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.split}>
      <div className={styles.left}>
        <img src="/images/auth-hero.png" alt="Exam Mastery" className={styles.heroImage} />
      </div>

      <div className={styles.right}>
        <div className={styles.card}>
          <h2 className={styles.title}>Reset your password</h2>
          <p className={styles.subtitle}>Enter your email to receive reset instructions</p>

          <form className={styles.form} onSubmit={handleSubmit} style={{ marginTop: 12 }}>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {message && <div className={styles.message}>{message}</div>}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <Link href="/auth/login" className={styles.secondaryLink}>
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
