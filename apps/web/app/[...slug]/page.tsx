"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  priceMinor: number | string;
};

export default function PublicRoute() {
  const path = usePathname();
  const [data, setData] = useState<Product[]>([]);

  useEffect(() => {
    if (path.startsWith("/products")) {
      fetch("/api/public/products").then((response) => response.json()).then(setData);
    }
  }, [path]);

  const title =
    path === "/services" ? "Services" :
    path === "/about" ? "About Lingo Store" :
    path === "/contact" ? "Contact" :
    path.startsWith("/products") ? "Products" :
    path.startsWith("/account") ? "My Account" :
    "Lingo Store";

  return (
    <main dir="rtl" style={{ fontFamily: "system-ui", maxWidth: 1100, margin: "auto", padding: 32 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
        <a href="/">Lingo Store</a>
        <nav>
          <a href="/products">Products</a> · <a href="/services">Services</a> ·{" "}
          <a href="/about">About</a> · <a href="/contact">Contact</a> ·{" "}
          <a href="/login">Login</a>
        </nav>
      </header>
      <h1>{title}</h1>
      {path.startsWith("/products") ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {data.map((product) => (
            <article key={product.id} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
              <h2>{product.name}</h2>
              <p>{product.description}</p>
              <strong>{(Number(product.priceMinor) / 100).toFixed(2)}</strong>
            </article>
          ))}
        </div>
      ) : <p>Public storefront route.</p>}
    </main>
  );
}
