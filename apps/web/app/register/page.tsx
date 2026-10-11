"use client";
import { FormEvent, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
export default function RegisterPage() {
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const response = await fetch(API + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim().toLowerCase(), password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error?.message || data.error || "Registration failed."); return; }
      setMessage(data.message || "If the address can be registered, a verification message has been sent.");
      setPassword("");
    } catch { setError("Registration could not be completed. Check your connection and try again."); }
    finally { setSaving(false); }
  }
  return <main className="auth-shell"><section className="auth-card"><a className="brand" href="/">Lingo Store</a><h1>Create account</h1><p className="muted">Create a customer account to order products and track your purchases.</p><form onSubmit={submit} className="form-stack">
    <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required /></label>
    <label>Phone <span className="muted">(optional)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={32} /></label>
    <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
    <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} maxLength={128} required /><small className="muted">Use at least 10 characters. Avoid using your email address.</small></label>
    <button className="button primary" type="submit" disabled={saving}>{saving ? "Creating account…" : "Create account"}</button>
  </form>{message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}<p className="muted">Already registered? <a href="/login">Sign in</a></p></section></main>;
}
