'use client';

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import styles from "../auth.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!email || !password) {
      setMessage("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      // TODO: replace with real API call (POST /api/auth/login)
      console.log("Login submit", { email, password });
      setMessage("Submitted — implement backend to complete login.");
    } catch (err) {
      setMessage("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // redirect to provider sign-in
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className={styles.split}>
      <div className={styles.left}>
        <img src="/images/auth-hero.png" alt="Exam Mastery" className={styles.heroImage} />
      </div>

      <div className={styles.right}>
        <div className={styles.card}>
          <h2 className={styles.title}>Sign in to AutoQgen</h2>
          <p className={styles.subtitle}>Access your question bank</p>


          <div style={{display:'flex', justifyContent:'flex-end', width:'100%'}}>
            <Link href="/auth/forgot" className={styles.forgotLink}>Forgot password?</Link>
          </div>

          <div className={styles.socialContainer} style={{ marginTop: 12 }}>
            <button type="button" className={styles.googleButton} onClick={handleGoogle}>
              <svg className={styles.googleIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3">
                <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.3-4.7-50.6H272v95.6h146.9c-6.3 34.3-25.6 63.3-54.6 82.9v68.9h88.3c51.7-47.6 81.9-117.9 81.9-196.8z"/>
                <path fill="#34A853" d="M272 544.3c73.7 0 135.6-24.6 180.8-66.8l-88.3-68.9c-24.6 16.5-56 26-92.4 26-71 0-131.1-48.1-152.6-112.6H28.6v70.9C74.1 497.9 167.8 544.3 272 544.3z"/>
                <path fill="#FBBC05" d="M119.4 321.9c-5.2-15.5-8.2-32.1-8.2-49.2s3-33.7 8.2-49.2V152.6H28.6C10.1 192.6 0 235.7 0 272.7s10.1 80.1 28.6 120.1l90.8-70.9z"/>
                <path fill="#EA4335" d="M272 109.1c39.8 0 75.5 13.7 103.7 40.8l77.7-77.7C402.9 26.5 345.7 0 272 0 167.8 0 74.1 46.4 28.6 123.6l90.8 70.9C140.9 157.2 201 109.1 272 109.1z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <div className={styles.divider}><span>Or continue with email</span></div>

          <form className={styles.form} onSubmit={handleSubmit}>
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

            {message && <div className={styles.message}>{message}</div>}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <Link href="/auth/signup" className={styles.secondaryLink}>
                Create account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
