"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <main className="customer-auth-shell">
      <section className="customer-auth-card">
        <Link className="customer-auth-brand" href="/"><img src="/lingo-logo.svg" alt="Lingo Store" /></Link>
        <div className="customer-auth-copy"><p className="eyebrow">Customer account</p><h1>Welcome back</h1><p className="muted">Sign in to manage your account, orders and shopping.</p></div>
        <form onSubmit={submit} className="customer-auth-form">
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          <button className="button primary" type="submit" disabled={saving}>{saving ? "Signing in…" : "Sign in"}</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="customer-auth-links"><Link href="/forgot-password">Forgot your password?</Link><span>New customer? <Link href="/register">Create an account</Link></span></div>
      </section>
      <aside className="customer-auth-aside" aria-hidden="true"><div className="customer-auth-mark">L</div><strong>Your account,<br />your store.</strong><p>Keep your profile and order history in one place.</p></aside>
    </main>
  );
}
