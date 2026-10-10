"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Product = {
  id: string;
  sku?: string;
  name: string;
  description?: string | null;
  priceMinor: number | string;
};
type User = { name?: string; email?: string; phone?: string; emailVerified?: boolean };
const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/">
          Lingo Store
        </Link>
        <nav className="nav">
          <Link href="/products">Products</Link>
          <Link href="/services">Services</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/account">Account</Link>
        </nav>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" href="/">
            Lingo Store
          </Link>
          <p className="muted">Secure storefront for modern retail.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <Link href="/products">Products</Link>
          <Link href="/services">Services</Link>
        </div>
        <div>
          <h3>Company</h3>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div>
          <h3>Account</h3>
          <Link href="/account">Profile</Link>
          <Link href="/account/orders">Orders</Link>
        </div>
      </div>
    </footer>
  );
}

export default function PublicRoute() {
  const path = usePathname();
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const tasks: Promise<unknown>[] = [];
    if (path.startsWith("/products/"))
      tasks.push(
        fetch(API + "/public/products")
          .then((r) => (r.ok ? r.json() : []))
          .then((x) => {
            if (active) setProducts(Array.isArray(x) ? x : []);
          }),
      );
    if (path.startsWith("/account/"))
      tasks.push(
        fetch(API + "/auth/me", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
          .then((x) => {
            if (active) setUser(x?.user || null);
          }),
      );
    Promise.allSettled(tasks).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [path]);
  const sku = useMemo(() => decodeURIComponent(path.split("/")[2] || ""), [path]);
  const product = products.find((p) => p.sku === sku);
  const title =
    path === "/account/orders"
      ? "My Orders"
      : path === "/account/security"
        ? "Security"
        : path.startsWith("/products/")
          ? "Product details"
          : "Lingo Store";
  if (path.startsWith("/products/"))
    return (
      <main className="site-shell">
        <Header />
        <section className="container section">
          {loading ? (
            <section className="card">
              <p className="muted">Loading product…</p>
            </section>
          ) : !product ? (
            <section className="card">
              <h1>Product not found</h1>
              <p className="muted">This product may have been removed or is no longer published.</p>
              <Link className="button primary" href="/products">
                Back to products
              </Link>
            </section>
          ) : (
            <>
              <div className="breadcrumbs">
                <Link href="/">Home</Link> / <Link href="/products">Products</Link> / {product.name}
              </div>
              <div className="detail-layout">
                <div className="detail-image" aria-hidden="true">
                  LS
                </div>
                <article className="detail-copy">
                  <p className="eyebrow">{product.sku || "PRODUCT"}</p>
                  <h1>{product.name}</h1>
                  <p className="muted" style={{ fontSize: 18, lineHeight: 1.7 }}>
                    {product.description ||
                      "A quality product selected for the Lingo Store catalog."}
                  </p>
                  <p className="price">{(Number(product.priceMinor) / 100).toFixed(2)} EGP</p>
                  <div className="info-list">
                    <div className="info-row">
                      <span className="muted">Availability</span>
                      <strong>Available in store</strong>
                    </div>
                    <div className="info-row">
                      <span className="muted">Customer support</span>
                      <strong>7 days</strong>
                    </div>
                  </div>
                  <div className="actions">
                    <Link className="button primary" href="/login">
                      Sign in to order
                    </Link>
                    <Link className="button secondary" href="/contact">
                      Ask about this product
                    </Link>
                  </div>
                </article>
              </div>
            </>
          )}
        </section>
        <Footer />
      </main>
    );
  if (path.startsWith("/account/"))
    return (
      <main className="site-shell">
        <Header />
        <section className="container section">
          <div className="breadcrumbs">
            <Link href="/account">My Account</Link> / {title}
          </div>
          {!user ? (
            <section className="card">
              <h1>Sign in required</h1>
              <p className="muted">Sign in to view your customer account.</p>
              <Link className="button primary" href="/login">
                Sign in
              </Link>
            </section>
          ) : path === "/account/orders" ? (
            <section>
              <div className="section-head">
                <div>
                  <p className="eyebrow">Account</p>
                  <h1>My Orders</h1>
                </div>
                <Link href="/products">Continue shopping</Link>
              </div>
              <div className="card">
                <h3>Order history</h3>
                <p className="muted">Your customer-owned orders will appear here when available.</p>
              </div>
            </section>
          ) : (
            <section className="card">
              <p className="eyebrow">Security</p>
              <h1>Account security</h1>
              <div className="info-list">
                <div className="info-row">
                  <span>Email</span>
                  <strong>{user.email || "—"}</strong>
                </div>
                <div className="info-row">
                  <span>Email status</span>
                  <strong>{user.emailVerified ? "Verified" : "Not verified"}</strong>
                </div>
              </div>
              <p className="muted">
                Use the account security controls to keep your customer session protected.
              </p>
            </section>
          )}
        </section>
        <Footer />
      </main>
    );
  return (
    <main className="site-shell">
      <Header />
      <section className="container section">
        <h1>{title}</h1>
        <p className="muted">The requested public page is not available.</p>
        <Link className="button primary" href="/">
          Return home
        </Link>
      </section>
      <Footer />
    </main>
  );
}
