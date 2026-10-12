"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Footer from "../../Footer";
import CleanProductImage from "../../CleanProductImage";
import FavoriteButton from "../../products/FavoriteButton";
import styles from "./favorites.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  imageUrl: string | null;
  brand: string | null;
  category: { id: string; name: string; description: string | null } | null;
};

function money(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n).toString().padStart(2, "0")} EGP`;
}

export default function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [favoritesResponse, productsResponse] = await Promise.all([
      fetch(API + "/account/favorites", { credentials: "include", cache: "no-store" }),
      fetch(API + "/public/products", { cache: "no-store" }),
    ]);
    if (favoritesResponse.status === 401) { location.href = "/login"; return; }
    if (!favoritesResponse.ok || !productsResponse.ok) throw new Error("Unable to load favorites.");
    const favorites = await favoritesResponse.json() as { productIds?: unknown };
    const catalog = await productsResponse.json() as unknown;
    const ids = Array.isArray(favorites.productIds) ? favorites.productIds.filter((id): id is string => typeof id === "string") : [];
    setFavoriteIds(new Set(ids));
    setProducts(Array.isArray(catalog) ? catalog as Product[] : []);
  }

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load favorites.")).finally(() => setLoading(false));
  }, []);

  const favorites = useMemo(() => products.filter((product) => favoriteIds.has(product.id)), [products, favoriteIds]);
  function setFavorite(productId: string, favorite: boolean) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(productId); else next.delete(productId);
      return next;
    });
  }

  return (
    <main className={`site-shell account-page ${styles.page}`}>
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/products">Shop</Link><Link href="/contact">Support</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header>
      <section className="container section">
        <div className="breadcrumbs"><Link href="/account">My account</Link> / Favorites</div>
        <div className="section-head"><div><p className="eyebrow">SAVED PRODUCTS</p><h1>Favorites</h1><p className="muted">Keep the products you are considering in one place.</p></div><Link className="button secondary" href="/products">Continue shopping</Link></div>
        {loading ? <section className="state-panel"><p role="status">Loading favorites…</p></section> : error ? <section className="state-panel" role="alert"><h2>Favorites unavailable</h2><p>{error}</p><button className="button primary" type="button" onClick={() => { setLoading(true); load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load favorites.")).finally(() => setLoading(false)); }}>Try again</button></section> : favorites.length === 0 ? <section className={`card ${styles.empty}`}><div className={styles.emptyIcon} aria-hidden="true">♡</div><h2>Your favorites are empty</h2><p className="muted">Tap the heart on any product to save it here.</p><Link className="button primary" href="/products">Browse products</Link></section> : (
          <div className={styles.grid}>
            {favorites.map((product) => (
              <article className={styles.card} key={product.id}>
                <div className={styles.image}>
                  <FavoriteButton productId={product.id} favorite={true} onChange={(favorite) => setFavorite(product.id, favorite)} />
                  <Link href={`/products/${encodeURIComponent(product.sku)}`} aria-label={`View ${product.name}`}>
                    {product.imageUrl ? <CleanProductImage src={product.imageUrl} alt={product.name} /> : <span aria-hidden="true">{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
                  </Link>
                </div>
                <Link className={styles.body} href={`/products/${encodeURIComponent(product.sku}`}>
                  <div className="product-meta-row"><span className="eyebrow">{product.category?.name || "Product"}</span>{product.brand && <span className="muted">{product.brand}</span>}</div>
                  <h2>{product.name}</h2>
                  {product.description && <p>{product.description}</p>}
                  <strong className="price">{money(product.priceMinor)}</strong>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}
