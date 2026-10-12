"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Profile = { id: string; email: string; name: string; phone?: string | null; emailVerified?: boolean };

function ProfileAvatar() {
  return (
    <span className="profile-avatar-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <circle cx="24" cy="17" r="7" />
        <path d="M10.5 39c1.7-7.2 6.3-10.8 13.5-10.8S35.8 31.8 37.5 39" />
      </svg>
    </span>
  );
}

export default function AccountPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await fetch(API + "/account/profile", { credentials: "include" });
    if (r.status === 401) { location.href = "/login"; return; }
    if (!r.ok) { setError("Unable to load account."); return; }
    const x = await r.json();
    setP(x); setName(x.name || ""); setPhone(x.phone || "");
  }
  useEffect(() => { load().catch(() => setError("Unable to load account.")); }, []);

  async function save() {
    setError(""); setSaved(""); setSaving(true);
    try {
      const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then((r) => r.json());
      const r = await fetch(API + "/account/profile", {
        method: "PATCH", credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({ name, phone }),
      });
      if (!r.ok) { const x = await r.json().catch(() => ({})); setError(x.error?.message || x.error || "Update failed."); return; }
      setP(await r.json()); setSaved("Profile saved.");
    } finally { setSaving(false); }
  }

  async function logout() {
    const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then((r) => r.json());
    await fetch(API + "/auth/logout", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": csrf.token }, body: "{}" });
    location.href = "/";
  }

  if (!p) return <main className="site-shell"><section className="container section"><section className="state-panel"><p role="status">{error || "Loading your account…"}</p></section></section></main>;

  return (
    <main className="site-shell account-page">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/products">Shop</Link><Link href="/contact">Support</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / My account</div>
        <div className="account-shell">
          <aside className="account-nav" aria-label="Account navigation">
            <div className="account-nav-brand"><ProfileAvatar /><div><strong>{p.name || "Customer"}</strong><small>{p.email}</small></div></div>
            <div className="account-nav-links">
              <Link className="active" href="/account"><span>Overview</span></Link>
              <Link href="/account/orders"><span>Orders</span></Link>
              <Link href="/account/profile"><span>Profile</span></Link>
              <Link href="/account/security"><span>Security</span></Link>
            </div>
            <button type="button" onClick={logout}><span>Sign out</span></button>
          </aside>

          <div className="account-content">
            <div className="account-hero">
              <div><p className="eyebrow">CUSTOMER ACCOUNT</p><h1>Welcome back, {p.name || "there"}.</h1><p className="muted">Manage your profile, orders and security from one place.</p></div>
              <Link className="button primary" href="/products">Continue shopping <span aria-hidden="true">→</span></Link>
            </div>

            <section className="account-profile-card">
              <div className="account-avatar"><ProfileAvatar /></div>
              <div>
                <div className="account-card-heading"><div><p className="eyebrow">PROFILE</p><h2>{p.name || "Your profile"}</h2><p className="account-email">{p.email}</p></div><Link href="/account/profile" className="account-edit-link">Edit profile</Link></div>
                <span className="account-status">{p.emailVerified ? "Email verified" : "Email not verified"}</span>
                <form className="account-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                  <div className="form-row">
                    <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
                    <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Add a phone number" /></label>
                  </div>
                  <div className="account-actions"><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
                </form>
                {saved && <p className="success" role="status">{saved}</p>}
                {error && <p className="error" role="alert">{error}</p>}
              </div>
            </section>

            <div className="account-quick-grid">
              <Link className="account-quick-card" href="/account/orders"><span className="account-quick-icon">↗</span><div><p className="eyebrow">ORDERS</p><h2>Order history</h2><p>Review your customer-owned web orders and linked store sales.</p></div><span className="account-arrow">→</span></Link>
              <Link className="account-quick-card" href="/account/security"><span className="account-quick-icon">✓</span><div><p className="eyebrow">SECURITY</p><h2>Password & security</h2><p>Change your password and keep your account protected.</p></div><span className="account-arrow">→</span></Link>
            </div>
          </div>
        </div>
      </section>
      <footer className="site-footer"><div className="container"><p className="muted">Lingo Store · Customer account</p></div></footer>
    </main>
  );
}
