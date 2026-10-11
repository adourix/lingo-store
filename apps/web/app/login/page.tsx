"use client";
import { FormEvent, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
export default function LoginPage() {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      const response = await fetch(API + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error?.message || data.error || "Invalid email or password."); return; }
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested ? new URL(requested, window.location.origin) : null;
      window.location.href = destination?.origin === window.location.origin ? destination.pathname + destination.search + destination.hash : "/account";
    } catch { setError("Sign in could not be completed. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <main className="auth-shell"><section className="auth-card"><a className="brand" href="/">Lingo Store</a><h1>Sign in</h1><p className="muted">Access your Lingo Store customer account.</p><form onSubmit={submit} className="form-stack"><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button primary" type="submit" disabled={saving}>{saving ? "Signing in…" : "Sign in"}</button></form>{error && <p className="error" role="alert">{error}</p>}<p className="muted"><a href="/forgot-password">Forgot your password?</a></p><p className="muted">New customer? <a href="/register">Create an account</a></p></section></main>;
}
