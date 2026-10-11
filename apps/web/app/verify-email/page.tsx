"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
function VerifyForm() {
  const q = useSearchParams(), [message, setMessage] = useState("Checking verification link…"), [working, setWorking] = useState(true);
  useEffect(() => {
    const fromQuery = q.get("token") || "";
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t") || "";
    const token = fromHash || fromQuery;
    if (fromQuery || fromHash) window.history.replaceState(null, "", window.location.pathname);
    if (!token) { setMessage("Verification link is invalid."); setWorking(false); return; }
    fetch(API + "/auth/verify-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (r) => { const j = await r.json().catch(() => ({})); setMessage(r.ok ? "Email verified successfully. You can sign in now." : j.error?.message || "Verification link is invalid or expired."); })
      .catch(() => setMessage("Verification failed. Please check your connection and try again."))
      .finally(() => setWorking(false));
  }, [q]);
  return <section className="auth-card"><a className="brand" href="/">Lingo Store</a><h1>Email verification</h1><p role="status">{message}</p>{!working && <a className="button primary" href="/login">Continue to sign in</a>}</section>;
}
export default function VerifyEmailPage() { return <main className="auth-shell"><Suspense fallback={<section className="auth-card"><p>Loading…</p></section>}><VerifyForm /></Suspense></main>; }
