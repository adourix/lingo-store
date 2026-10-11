"use client";

import { FormEvent, useState } from "react";
import { login } from "../lib/api";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await login(username.trim(), password);
      window.location.href = "/";
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign in failed";
      if (message === "TERMINAL_REENROLLMENT_REQUIRED") {
        setError("This terminal is not registered. Register it before signing in.");
      } else if (message === "FORBIDDEN") {
        setError("This account does not have POS access.");
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="pos-center">
      <form className="pos-card pos-form" onSubmit={submit}>
        <div className="pos-brand">LINGO POS</div>
        <h1>Cashier sign in</h1>
        <p>Use a staff account with POS access on this registered terminal.</p>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="pos-button primary" disabled={saving}>
          {saving ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="pos-error">{error}</p>}
        <a href="/enroll">Register this terminal</a>
      </form>
    </main>
  );
}
