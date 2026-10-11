"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage(""); setError(""); setSaving(true);
    try {
      const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then((r) => r.json());
      const r = await fetch(API + "/account/security/password", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error?.message || j.error || "Password change failed."); return; }
      setMessage("Password changed. Other sessions were signed out.");
      setCurrentPassword(""); setNewPassword("");
    } finally { setSaving(false); }
  }

  return (
    <main className="site-shell account-page">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/products">Shop</Link><Link href="/contact">Support</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav"><Link href="/products">Shop</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/account">My Account</Link> / Security</div>
        <div className="account-shell">
          <aside className="account-nav" aria-label="Account navigation"><Link href="/account">Overview</Link><Link href="/account/orders">Orders</Link><Link className="active" href="/account/security">Security</Link></aside>
          <div className="account-content">
            <div className="account-hero"><div><p className="eyebrow">Account security</p><h1>Protect your account</h1><p className="muted">Change your password and sign out other active sessions.</p></div></div>
            <section className="account-profile-card" style={{ display: "block" }}>
              <h2>Change password</h2>
              <p className="muted">Use a strong password you do not reuse elsewhere.</p>
              <form className="account-form" onSubmit={submit}>
                <div className="form-row">
                  <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required /></label>
                  <label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required /></label>
                </div>
                <div className="account-actions"><button className="button primary" disabled={saving}>{saving ? "Changing…" : "Change password"}</button><Link className="button secondary" href="/account">Cancel</Link></div>
              </form>
              {message && <p className="success" role="status">{message}</p>}
              {error && <p className="error" role="alert">{error}</p>}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
