"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type OrderItem = { productName?: string; quantity?: number | string; totalMinor?: string | number; product?: { name?: string } };
type Order = { id: string; invoiceNo?: string; status?: string; paymentStatus?: string; paymentMethod?: string; totalMinor?: string | number; createdAt?: string; items?: OrderItem[] };
function money(value: string | number | undefined): string { if (value === undefined) return "—"; const n = BigInt(value); return `${new Intl.NumberFormat("en").format(n / 100n)}.${(n % 100n).toString().padStart(2, "0")} EGP`; }
function label(value?: string): string { return (value || "PENDING").replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()); }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch(API + "/account/orders", { credentials: "include", cache: "no-store" });
      if (r.status === 401) { location.href = "/login?next=%2Faccount%2Forders"; return; }
      if (!r.ok) throw new Error("Unable to load your orders.");
      const body: unknown = await r.json();
      if (!Array.isArray(body)) throw new Error("Invalid orders response.");
      setOrders(body as Order[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your orders."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return (
    <main className="site-shell">
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/">Lingo Store</Link><nav className="nav"><Link href="/products">Products</Link><Link href="/cart">Cart</Link><Link href="/account">Account</Link></nav></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/account">My Account</Link> / Orders</div>
        <div className="section-head"><div><p className="eyebrow">Account</p><h1>My orders</h1><p className="muted">Your customer-owned web orders and linked store sales.</p></div><Link href="/products">Continue shopping</Link></div>
        {loading ? <section className="card"><p role="status">Loading orders…</p></section> : error ? <section className="card" role="alert"><h2>Orders unavailable</h2><p className="muted">{error}</p><button className="button primary" onClick={() => void load()}>Try again</button></section> : orders.length === 0 ? <section className="card"><h2>No orders yet</h2><p className="muted">Your completed orders will appear here.</p><Link className="button primary" href="/products">Start shopping</Link></section> : <div className="grid">{orders.map((order) => <article className="card" key={order.id}><div className="product-meta-row"><div><p className="eyebrow">{order.invoiceNo || "Order"}</p><h2>{label(order.status)}</h2></div><strong>{money(order.totalMinor)}</strong></div><p className="muted">{order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · {label(order.paymentMethod)}</p>{order.items?.length ? <ul>{order.items.slice(0, 5).map((item, index) => <li key={`${order.id}-${index}`}>{item.productName || item.product?.name || "Product"} × {String(item.quantity ?? 1)}</li>)}</ul> : null}</article>)}</div>}
      </section>
    </main>
  );
}
