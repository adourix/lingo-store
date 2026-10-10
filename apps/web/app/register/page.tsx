"use client";

import { FormEvent, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch(API + "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error?.message || data.error || "Registration failed.");
      return;
    }
    setMessage(data.message || "Check your email to verify your account.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="brand" href="/">
          Lingo Store
        </a>
        <h1>Create account</h1>
        <form onSubmit={submit} className="form-stack">
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <button className="button primary" type="submit">
            Create account
          </button>
        </form>
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted">
          Already registered? <a href="/login">Sign in</a>
        </p>
      </section>
    </main>
  );
}
