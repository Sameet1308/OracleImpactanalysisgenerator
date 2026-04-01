"use client";

import { useState } from "react";

type Props = { onLogin: () => void };

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 800);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Ora1</div>
        <h1 className="login-title">AI_Elite_Ora1</h1>
        <p className="login-subtitle">Oracle Impact Analysis Platform</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="Username or Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="login-hint">Single Sign-On (SSO) via Oracle IDCS</p>
      </div>
    </div>
  );
}
