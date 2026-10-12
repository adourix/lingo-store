"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountSidebar from "../AccountSidebar";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type OrderItem = { productName?: string; quantity?: number | string; totalMinor?: string | number; product?: { name?: string } };
type Order = { id: string; invoiceNo?: string; status?: string; paymentStatus?: string; paymentMethod?: string; totalMinor?: string | number; createdAt?: string; items?: OrderItem[] };
function money(value: string | number | undefined): string { if (value === undefined) return "—"; const n = BigInt(value); return `${new Intl.NumberFormat("en").format(n / 100n)}.${(n % 100n).toString().padStart(2, "0")} EGP`; }
function label(value?: string): string { return (value || "PENDING").replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()); }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const r = await fetch(API + "/account/orders", { credentials: "include", cache: "no-store" }); if (r.status === 401) { location.href = "/login?next=%2Faccount%2Forders"; return; } if (!r.ok) throw new Error("Unable to load your orders."); const body: unknown = await r.json(); if (!Array.isArray(body)) throw new Error("Invalid orders response."); setOrders(body as Order[]); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your orders."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <main className="site-shell account-page">
    <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/products">Shop</Link><Link href="/contact">Support</Link></div></div></div>
    <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
    <section className="container section"><div className="breadcrumbs"><Link href="/account">My account</Link> / Orders</div><div className="account-shell"><AccountSidebar active="orders" /><div className="account-content"><div className="account-hero"><div><p className="eyebrow">ORDER HISTORY</p><h1>My orders</h1><p className="muted">Review and track your purchases from Lingo Store.</p></div><Link className="button primary" href="/products">Continue shopping →</Link></div>{loading ? <section className="state-panel"><p role="status">Loading orders…</p></section> : error ? <section className="state-panel" role="alert"><h2>Orders unavailable</h2><p>{error}</p><button className="button primary" style={{ marginTop: 16 }} onClick={() => void load()}>Try again</button></section> : orders.length === 0 ? <section className="state-panel"><h2>No orders yet</h2><p>Your completed orders will appear here.</p><Link className="button primary" style={{ marginTop: 16 }} href="/products">Start shopping</Link></section> : <div className="account-orders">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-header"><div><p className="eyebrow">{order.invoiceNo || "Order"}</p><h2>{label(order.status)}</h2><p className="muted">{order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · {label(order.paymentMethod)}</p></div><strong className="order-total">{money(order.totalMinor)}</strong></div>{order.items?.length ? <ul className="order-items">{order.items.slice(0, 5).map((item, index) => <li key={`${order.id}-${index}`}><span>{item.productName || item.product?.name || "Product"}</span><strong>× {String(item.quantity ?? 1)}</strong></li>)}</ul> : null}</article>)}</div>}</div></div></section>
  </main>;
}
