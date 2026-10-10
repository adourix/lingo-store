"use client";
import { FormEvent, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await fetch(API + "/auth/request-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setDone(true);
  }
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="brand" href="/">
          Lingo Store
        </a>
        <h1>Forgot password</h1>
        {done ? (
          <>
            <p className="success">If the address is eligible, a reset message has been sent.</p>
            <a href="/login">Back to sign in</a>
          </>
        ) : (
          <form className="form-stack" onSubmit={submit}>
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
            <button className="button primary">Send reset link</button>
          </form>
        )}
      </section>
    </main>
  );
}
