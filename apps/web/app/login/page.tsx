"use client";

import { FormEvent, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error?.message || data.error || "Invalid credentials.");
      return;
    }
    window.location.href = "/account";
  }

  return <main className="auth-shell"><section className="auth-card">
    <a className="brand" href="/">Lingo Store</a>
    <h1>Sign in</h1>
    <p className="muted">Access your Lingo Store customer account.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      <button className="button primary" type="submit">Sign in</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    <p className="muted"><a href="/forgot-password">Forgot your password?</a></p>
    <p className="muted">New customer? <a href="/register">Create an account</a></p>
  </section></main>;
}
