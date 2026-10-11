"use client";
import { FormEvent, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""), [done, setDone] = useState(false), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setError(""); setSaving(true); try { const r = await fetch(API + "/auth/request-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase() }) }); if (!r.ok) throw new Error("Unable to request a reset link."); setDone(true); } catch (x) { setError(x instanceof Error ? x.message : "Unable to request a reset link."); } finally { setSaving(false); } }
  return <main className="auth-shell"><section className="auth-card"><a className="brand" href="/">Lingo Store</a><h1>Forgot password</h1>{done ? <><p className="success" role="status">If the address is eligible, a reset message has been sent.</p><a href="/login">Back to sign in</a></> : <form className="form-stack" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label><button className="button primary" disabled={saving}>{saving ? "Sending…" : "Send reset link"}</button>{error && <p className="error" role="alert">{error}</p>}</form>}</section></main>;
}
