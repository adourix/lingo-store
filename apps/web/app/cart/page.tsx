"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const CART_KEY = "lingo-cart-v1";
type CartLine = { productId: string; quantity: number };
type Product = { id: string; name: string; sku: string; priceMinor: string | number; description: string | null };

function formatMinor(value: string | number): string {
  const amount = BigInt(value);
  return `${new Intl.NumberFormat("en").format(amount / 100n)}.${(amount % 100n).toString().padStart(2, "0")} EGP`;
}
function validCart(value: unknown): value is CartLine[] {
  return Array.isArray(value) && value.every((item) => Boolean(item) && typeof item === "object" && "productId" in item && typeof item.productId === "string" && "quantity" in item && typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 999);
}

export default function CartPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    try { const parsed = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]"); if (validCart(parsed)) setCart(parsed); } catch { setCart([]); }
    fetch(API + "/public/products", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error("Catalog unavailable."); const body: unknown = await r.json(); if (!Array.isArray(body)) throw new Error("Invalid catalog response."); setProducts(body as Product[]); })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load cart."))
      .finally(() => setLoading(false));
  }, []);
  const catalog = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const total = cart.reduce((sum, line) => { const p = catalog.get(line.productId); return p ? sum + BigInt(p.priceMinor) * BigInt(Math.round(line.quantity * 1000)) / 1000n : sum; }, 0n);
  function save(next: CartLine[]) { setCart(next); sessionStorage.setItem(CART_KEY, JSON.stringify(next)); window.dispatchEvent(new Event("lingo-cart-updated")); }
  return (
    <main className="site-shell">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/contact">Need help?</Link><Link href="/products">Continue shopping</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav" aria-label="Cart navigation"><Link href="/products">Shop</Link><Link href="/account">Account</Link></nav><div className="header-actions"><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / Cart</div>
        <div className="section-head"><div><p className="eyebrow">SHOPPING BAG</p><h1>Your cart</h1><p className="muted">Review your items before continuing to checkout.</p></div><Link className="button secondary" href="/products">Continue shopping</Link></div>
        {loading ? <section className="card"><p role="status">Loading cart…</p></section> : error ? <section className="card" role="alert"><h2>Cart unavailable</h2><p className="muted">{error}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></section> : cart.length === 0 ? <section className="card"><h2>Your cart is empty</h2><p className="muted">Add products from the catalog and they will appear here.</p><Link className="button primary" href="/products">Browse products</Link></section> : (
          <div className="checkout-layout">
            <section className="card"><h2>Items</h2><ul className="checkout-items">{cart.map((line) => { const p = catalog.get(line.productId); return <li key={line.productId}><div><strong>{p?.name || "Unavailable product"}</strong><p>{p ? formatMinor(p.priceMinor) : "Unavailable"}</p></div><label>Quantity<input type="number" min="1" max="999" step="1" value={line.quantity} onChange={(e) => { const q = Number(e.target.value); if (!Number.isFinite(q) || q <= 0) save(cart.filter((x) => x.productId !== line.productId)); else save(cart.map((x) => x.productId === line.productId ? { ...x, quantity: Math.min(999, q) } : x)); }} /></label><button className="button secondary" type="button" onClick={() => save(cart.filter((x) => x.productId !== line.productId))}>Remove</button></li>; })}</ul></section>
            <aside className="card"><p className="muted">Estimated total</p><p className="price">{formatMinor(total.toString())}</p><p className="muted">The server recalculates current prices and stock at checkout.</p><Link className="button primary" href="/checkout">Continue to checkout</Link></aside>
          </div>
        )}
      </section>
      <footer className="site-footer"><div className="container footer-grid"><div><img className="footer-logo" src="/lingo-logo.svg" alt="Lingo" /><p className="muted">Lingo Store customer storefront.</p></div><div><h3>Shop</h3><Link href="/products">Products</Link><Link href="/cart">Cart</Link></div><div><h3>Company</h3><Link href="/about">About</Link><Link href="/contact">Contact</Link></div><div><h3>Account</h3><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></div></div></footer>
    </main>
  );
}
