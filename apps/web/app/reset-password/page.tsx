"use client";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
function ResetForm() {
  const q = useSearchParams(), [token, setToken] = useState(""), [password, setPassword] = useState(""), [done, setDone] = useState(false), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  useEffect(() => {
    const fromQuery = q.get("token") || "";
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t") || "";
    const value = fromHash || fromQuery;
    setToken(value);
    if (fromQuery) window.history.replaceState(null, "", window.location.pathname);
    if (fromHash) window.history.replaceState(null, "", window.location.pathname);
  }, [q]);
  async function submit(e: FormEvent) { e.preventDefault(); setError(""); setSaving(true); try { const r = await fetch(API + "/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || j.error || "Reset failed."); setDone(true); } catch (x) { setError(x instanceof Error ? x.message : "Reset failed."); } finally { setSaving(false); } }
  return <section className="auth-card"><a className="brand" href="/">Lingo Store</a><h1>Choose a new password</h1>{done ? <><p className="success" role="status">Password reset successfully. Sign in again.</p><a href="/login">Continue</a></> : <form className="form-stack" onSubmit={submit}><label>New password<input type="password" minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /><small className="muted">Use at least 10 characters.</small></label><button className="button primary" disabled={!token || saving}>{saving ? "Changing password…" : "Change password"}</button>{error && <p className="error" role="alert">{error}</p>}</form>}</section>;
}
export default function ResetPasswordPage() { return <main className="auth-shell"><Suspense fallback={<section className="auth-card"><p>Loading…</p></section>}><ResetForm /></Suspense></main>; }
