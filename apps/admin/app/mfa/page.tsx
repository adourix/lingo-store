"use client";

import { useState } from "react";

const A = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function Mfa() {
  const [otp, setOtp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const csrfResponse = await fetch(A + "/admin/auth/csrf", { credentials: "include" });
      const csrf = await csrfResponse.json().catch(() => ({}));
      if (!csrfResponse.ok || !csrf.token) {
        setError("Unable to start verification. Please try again.");
        return;
      }

      const payload = recoveryCode.trim()
        ? { otp: otp.trim(), recoveryCode: recoveryCode.trim() }
        : { otp: otp.trim() };

      const response = await fetch(A + "/admin/auth/mfa", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf.token,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        window.location.href = "/";
        return;
      }

      setError(result.error || "The verification code is invalid. Please try again.");
    } catch {
      setError("Unable to verify right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-auth-shell">
      <section className="admin-auth-card" aria-labelledby="mfa-title">
        <div className="admin-auth-brand">
          <img src="/lingo-logo.svg" alt="Lingo" />
          <span>Admin</span>
        </div>

        <div className="admin-auth-heading">
          <p className="admin-auth-eyebrow">SECURE SIGN-IN</p>
          <h1 id="mfa-title">Verify your identity</h1>
          <p className="admin-auth-description">
            Enter the 6-digit code from your authenticator app to continue to the admin panel.
          </p>
        </div>

        <form onSubmit={submit} className="admin-auth-form">
          <label>
            Authenticator code
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              aria-describedby={error ? "mfa-error" : undefined}
              required
              autoFocus
            />
          </label>

          <label>
            Recovery code <span className="admin-auth-label-muted">Optional</span>
            <input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              autoComplete="off"
              placeholder="Enter a recovery code if needed"
              aria-describedby={error ? "mfa-error" : undefined}
            />
          </label>

          {error ? (
            <p id="mfa-error" className="admin-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="admin-auth-submit" disabled={loading || otp.length !== 6}>
            {loading ? "Verifying…" : "Verify and continue"}
          </button>
        </form>

        <p className="admin-auth-security-note">
          Your verification is protected by the admin security layer.
        </p>
      </section>
    </main>
  );
}
