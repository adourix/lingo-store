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
      <section className="admin-auth-card admin-mfa-card" aria-labelledby="mfa-title">
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
              className="admin-mfa-otp"
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

      <style jsx global>{`
        .admin-mfa-card {
          padding: 34px;
        }

        .admin-auth-heading {
          margin-bottom: 4px;
        }

        .admin-auth-eyebrow {
          margin: 0 0 9px;
          color: #2335ad;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .admin-auth-description {
          margin: 0;
          max-width: 390px;
          color: #667085;
          font-size: 14px;
          line-height: 1.65;
        }

        .admin-auth-form {
          gap: 15px;
          margin-top: 24px;
        }

        .admin-auth-form label {
          gap: 7px;
        }

        .admin-auth-label-muted {
          color: #98a2b3;
          font-weight: 600;
          margin-inline-start: 3px;
        }

        .admin-mfa-otp {
          font-variant-numeric: tabular-nums;
          letter-spacing: .22em;
          font-size: 20px !important;
          font-weight: 800;
          text-align: center;
        }

        .admin-mfa-otp::placeholder {
          color: #d0d5dd;
          letter-spacing: .22em;
        }

        .admin-auth-submit {
          width: 100%;
          min-height: 46px;
          margin-top: 2px;
          border: 0;
          border-radius: 10px;
          background: #2335ad;
          color: #fff;
          font-weight: 800;
          box-shadow: 0 8px 20px rgb(35 53 173 / .18);
          transition: background .15s, transform .15s, box-shadow .15s, opacity .15s;
        }

        .admin-auth-submit:hover:not(:disabled) {
          background: #18268b;
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgb(35 53 173 / .22);
        }

        .admin-auth-submit:disabled {
          cursor: not-allowed;
          opacity: .48;
          box-shadow: none;
        }

        .admin-auth-security-note {
          margin: 18px 0 0;
          padding-top: 15px;
          border-top: 1px solid #eef1f5;
          color: #98a2b3;
          font-size: 11px;
          text-align: center;
        }

        @media (max-width: 480px) {
          .admin-mfa-card {
            padding: 26px 22px;
          }
        }
      `}</style>
    </main>
  );
}
