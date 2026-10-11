"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Profile = { id: string; email: string; name: string; phone?: string | null; emailVerified?: boolean };

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

  const initial = (p.name || p.email || "L").trim().charAt(0).toUpperCase();
  return (
    <main className="site-shell account-page">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/products">Shop</Link><Link href="/contact">Support</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav"><Link href="/products">Shop</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / My account</div>
        <div className="account-shell">
          <aside className="account-nav" aria-label="Account navigation">
            <Link className="active" href="/account">Overview</Link>
            <Link href="/account/orders">Orders</Link>
            <Link href="/account/security">Security</Link>
            <button type="button" onClick={logout}>Sign out</button>
          </aside>
          <div className="account-content">
            <div className="account-hero"><div><p className="eyebrow">Customer account</p><h1>My account</h1><p className="muted">Manage your profile, orders and account security.</p></div></div>
            <section className="account-profile-card">
              <div className="account-avatar" aria-hidden="true">{initial}</div>
              <div>
                <h2>{p.name || "Your profile"}</h2>
                <p className="account-email">{p.email}</p>
                <span className="account-status">{p.emailVerified ? "Email verified" : "Email not verified"}</span>
                <form className="account-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                  <div className="form-row">
                    <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
                    <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                  </div>
                  <div className="account-actions"><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
                </form>
                {saved && <p className="success" role="status">{saved}</p>}
                {error && <p className="error" role="alert">{error}</p>}
              </div>
            </section>
            <div className="grid" style={{ marginTop: 18 }}>
              <Link className="card" href="/account/orders"><p className="eyebrow">Orders</p><h2>Order history</h2><p className="muted">Review your customer-owned web orders and linked store sales.</p></Link>
              <Link className="card" href="/account/security"><p className="eyebrow">Security</p><h2>Password & security</h2><p className="muted">Change your password and keep your account protected.</p></Link>
            </div>
          </div>
        </div>
      </section>
      <footer className="site-footer"><div className="container"><p className="muted">Lingo Store · Customer account</p></div></footer>
    </main>
  );
}
