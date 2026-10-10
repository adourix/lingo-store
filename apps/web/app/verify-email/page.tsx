"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
function VerifyForm() {
  const q = useSearchParams(),
    [message, setMessage] = useState("Verifying email…");
  useEffect(() => {
    const token = q.get("token") || "";
    if (!token) {
      setMessage("Verification link is invalid.");
      return;
    }
    fetch(API + "/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setMessage(
          r.ok
            ? "Email verified successfully."
            : j.error?.message || "Verification link is invalid or expired.",
        );
      })
      .catch(() => setMessage("Verification failed. Please try again."));
  }, [q]);
  return (
    <section className="auth-card">
      <a className="brand" href="/">
        Lingo Store
      </a>
      <h1>Email verification</h1>
      <p>{message}</p>
      <a href="/login">Continue to sign in</a>
    </section>
  );
}
export default function VerifyEmailPage() {
  return (
    <main className="auth-shell">
      <Suspense
        fallback={
          <section className="auth-card">
            <p>Loading…</p>
          </section>
        }
      >
        <VerifyForm />
      </Suspense>
    </main>
  );
}
