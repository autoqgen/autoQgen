"use client";

import { useState } from "react";

export default function TestSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleTest = async (e) => {
    e.preventDefault();

    console.log("🔥 TEST PAGE CLICKED");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test User",
          email,
          password,
        }),
      });

      console.log("📡 STATUS:", res.status);

      const data = await res.json();

      console.log("📦 RESPONSE:", data);

      setMessage(data.message || "Done");
    } catch (err) {
      console.log("❌ ERROR:", err);
      setMessage("Server error");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>🧪 Signup Test Page</h2>

      <form onSubmit={handleTest}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", marginBottom: 10 }}
        />

        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", marginBottom: 10 }}
        />

        <button type="submit">Test Signup</button>
      </form>

      <p>{message}</p>
    </div>
  );
}
