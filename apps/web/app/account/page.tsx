"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Footer from "../Footer";
import CleanProductImage from "../CleanProductImage";
import AccountSidebar from "./AccountSidebar";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const META_PREFIX = "[[LINGO_PRODUCT_META]]";
type Profile = { id: string; email: string; name: string; phone?: string | null; emailVerified?: boolean };
type HeroProduct = { id: string; name: string; imageUrl: string | null };

function parseImage(description: unknown): string | null {
  if (typeof description !== "string") return null;
  const marker = description.indexOf(META_PREFIX);
  if (marker < 0) return null;
  try { const meta = JSON.parse(description.slice(marker + META_PREFIX.length).trim()) as { imageUrl?: unknown }; return typeof meta.imageUrl === "string" ? meta.imageUrl : null; } catch { return null; }
}

export default function AccountPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [heroProducts, setHeroProducts] = useState<HeroProduct[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await fetch(API + "/account/profile", { credentials: "include", cache: "no-store" });
    if (r.status === 401) { location.href = "/login"; return; }
    if (!r.ok) { setError("Unable to load account."); return; }
    const x = await r.json();
    setP(x); setName(x.name || ""); setPhone(x.phone || "");
    try {
      const catalogResponse = await fetch(API + "/public/products", { cache: "no-store" });
      const catalog = await catalogResponse.json() as unknown;
      if (Array.isArray(catalog)) {
        const items = catalog.filter((item): item is { id: string; name: string; description?: string | null } => !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && typeof (item as { name?: unknown }).name === "string");
        setHeroProducts(items.map((item) => ({ id: item.id, name: item.name, imageUrl: parseImage(item.description) })).filter((item) => item.imageUrl).slice(0, 3));
      }
    } catch { /* Hero art is optional; account data remains usable. */ }
  }
  useEffect(() => { load().catch(() => setError("Unable to load account.")); }, []);

  async function save() {
    setError(""); setSaved(""); setSaving(true);
    try {
      const csrf = await fetch(API + "/auth/csrf", { credentials: "include" }).then((r) => r.json());
      const r = await fetch(API + "/account/profile", { method: "PATCH", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": csrf.token }, body: JSON.stringify({ name, phone }) });
      if (!r.ok) { const x = await r.json().catch(() => ({})); setError(x.error?.message || x.error || "Update failed."); return; }
      const next = await r.json(); setP(next); setSaved("Profile saved.");
    } finally { setSaving(false); }
  }

  if (!p) return <main className="site-shell account-page"><section className="container section"><section className="state-panel"><p role="status">{error || "Loading your account…"}</p></section></section></main>;

  return (
    <main className="site-shell account-page">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/products">Shop</Link><Link href="/contact">Support</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / My account</div>
        <div className="account-shell">
          <AccountSidebar active="overview" profile={p} />
          <div className="account-content">
            <section className="account-hero">
              <div><p className="eyebrow">MY ACCOUNT</p><h1>Welcome back,<br /><span style={{ color: "#3152d9" }}>{p.name || "there"}.</span></h1><p className="muted">Manage your profile, orders and security from one place.</p></div>
              {heroProducts.length > 0 && <div className="account-hero-art" aria-hidden="true">{heroProducts.map((product, index) => <div key={product.id} className={`account-hero-product ${index === 0 ? "one" : index === 1 ? "two" : "three"}`}><CleanProductImage src={product.imageUrl!} alt="" /></div>)}</div>}
            </section>

            <section className="account-profile-card">
              <div className="account-avatar"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="7" /><path d="M10.5 39c1.7-7.2 6.3-10.8 13.5-10.8S35.8 31.8 37.5 39" /></svg></div>
              <div>
                <div className="account-card-heading"><div><p className="eyebrow">PROFILE</p><h2>{p.name || "Your profile"}</h2><p className="account-email">{p.email}</p></div><Link href="/account/profile" className="account-edit-link">Edit profile</Link></div>
                <span className="account-status">{p.emailVerified ? "Email verified" : "Email not verified"}</span>
                <form className="account-form" onSubmit={(e) => { e.preventDefault(); void save(); }}><div className="form-row"><label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Add a phone number" /></label></div><div className="account-actions"><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></form>
                {saved && <p className="success" role="status">{saved}</p>}{error && <p className="error" role="alert">{error}</p>}
              </div>
            </section>

            <div className="account-quick-grid">
              <Link className="account-quick-card" href="/account/orders"><span className="account-quick-icon">▣</span><div><p className="eyebrow">ORDERS</p><h2>Order history</h2><p>View and track your orders, and see your purchases.</p></div><span className="account-arrow">→</span></Link>
              <Link className="account-quick-card" href="/account/favorites"><span className="account-quick-icon">♡</span><div><p className="eyebrow">FAVORITES</p><h2>Favorites</h2><p>Save the products you love and find them easily later.</p></div><span className="account-arrow">→</span></Link>
              <Link className="account-quick-card" href="/account/security"><span className="account-quick-icon">◇</span><div><p className="eyebrow">SECURITY</p><h2>Password &amp; security</h2><p>Change your password and keep your account protected.</p></div><span className="account-arrow">→</span></Link>
            </div>

            <section className="account-help-banner"><div><p className="eyebrow">NEED HELP?</p><h2>We’re here for you.</h2></div><p>If you have any questions or need assistance with your orders, products or services, our team is ready to help.</p><Link className="button" href="/contact">Contact support →</Link></section>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
