'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth/auth.module.css';

function ResetContent() {
  const search = useSearchParams();
  const token = search?.get('token') || '';
  const email = search?.get('email') || '';
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!password) return setMessage('Enter a password');
    if (password !== confirm) return setMessage("Passwords don't match");

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Reset failed');
      setMessage('Password updated — you can now sign in');
      setTimeout(() => router.push('/auth/login'), 1200);
    } catch (err) {
      setMessage(err.message || 'Failed to reset password');
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
          <h2 className={styles.title}>Reset password</h2>
          <p className={styles.subtitle}>Set a new password for your account</p>

          <form className={styles.form} onSubmit={handleSubmit} style={{ marginTop: 12 }}>
            <input
              className={styles.input}
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              className={styles.input}
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            {message && <div className={styles.message}>{message}</div>}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? 'Saving...' : 'Save new password'}
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

export default function Reset() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    }>
      <ResetContent />
    </Suspense>
  );
}
