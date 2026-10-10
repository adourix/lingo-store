"use client";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
function ResetForm() {
  const q = useSearchParams(),
    [password, setPassword] = useState(""),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch(API + "/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: q.get("token") || "", password }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setDone(true);
    else setError(j.error?.message || j.error || "Reset failed.");
  }
  return (
    <section className="auth-card">
      <a className="brand" href="/">
        Lingo Store
      </a>
      <h1>Choose a new password</h1>
      {done ? (
        <>
          <p className="success">Password reset. Sign in again.</p>
          <a href="/login">Continue</a>
        </>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="button primary" disabled={!q.get("token")}>
            Change password
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </section>
  );
}
export default function ResetPasswordPage() {
  return (
    <main className="auth-shell">
      <Suspense
        fallback={
          <section className="auth-card">
            <p>Loading…</p>
          </section>
        }
      >
        <ResetForm />
      </Suspense>
    </main>
  );
}
