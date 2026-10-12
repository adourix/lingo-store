"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CART_KEY = "lingo-cart-v1";

type CartLine = { productId: string; quantity: number };

function readCartCount(): number {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(value)) return 0;
    return value.reduce((total, item) => {
      if (!item || typeof item !== "object") return total;
      const quantity = (item as CartLine).quantity;
      return typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? total + quantity : total;
    }, 0);
  } catch {
    return 0;
  }
}

export default function Header() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const sync = () => setCartCount(readCartCount());
    sync();
    window.addEventListener("lingo-cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lingo-cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Free shipping for orders over 1,000 EGP</span>
          <div>
            <Link href="/contact">Need help?</Link>
            <span aria-hidden="true">·</span>
            <Link href="/products">Track order</Link>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Lingo Store home">
            <img src="/lingo-logo.svg" alt="Lingo" />
          </Link>
          <nav className="nav" aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/products">Shop</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Support</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-action" href="/products" aria-label="Browse products">Search</Link>
            <Link className="header-action" href="/account">Account</Link>
            <Link className="header-cart" href="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}>
              Cart{cartCount > 0 && <span className="header-cart-count" aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>
      <style jsx>{`
        .header-cart { position:relative; }
        .header-cart-count { display:inline-grid; place-items:center; min-width:18px; height:18px; padding:0 5px; margin-left:6px; border-radius:999px; background:#f97316; color:#fff; font-size:10px; line-height:1; font-weight:800; vertical-align:middle; }
      `}</style>
    </>
  );
}
