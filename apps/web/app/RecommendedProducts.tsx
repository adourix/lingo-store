"use client";

import Link from "next/link";
import CleanProductImage from "./CleanProductImage";
import { parseProductDescription } from "./product-meta";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: string | number;
  imageUrl?: string | null;
  brand?: string | null;
  stock?: number | string | null;
  category?: { id: string; name: string } | null;
};

function money(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n).toString().padStart(2, "0")} EGP`;
}

function imageFor(product: Product): string | null {
  return product.imageUrl || parseProductDescription(product.description).imageUrl;
}

function score(candidate: Product, source: Product[]): number {
  return Math.max(...source.map((item) => {
    const sameCategory = Boolean(candidate.category?.id && item.category?.id && String(candidate.category.id) === String(item.category.id));
    const sameBrand = Boolean(candidate.brand && item.brand && candidate.brand.trim().toLowerCase() === item.brand.trim().toLowerCase());
    const tokens = new Set(`${item.name} ${item.brand || ""}`.toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((x) => x.length >= 3));
    const overlap = `${candidate.name} ${candidate.brand || ""}`.toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((x) => x.length >= 3).filter((x) => tokens.has(x)).length;
    return (sameCategory ? 70 : 0) + (sameBrand ? 30 : 0) + Math.min(20, overlap * 10);
  }));
}

export default function RecommendedProducts({ products, excludeIds = [], title = "You may also like" }: { products: Product[]; excludeIds?: string[]; title?: string }) {
  const excluded = new Set(excludeIds.map(String));
  const available = products.filter((product) => !excluded.has(String(product.id)) && (product.stock === null || product.stock === undefined || Number(product.stock) > 0));
  if (available.length === 0) return null;
  const source = products.filter((product) => excluded.has(String(product.id)));
  const ranked = available.map((product) => ({ product, score: source.length ? score(product, source) : 0 }))
    .sort((a, b) => b.score - a.score || Number(a.product.priceMinor) - Number(b.product.priceMinor));
  const recommendations = ranked.slice(0, 5).map(({ product }) => product);

  return (
    <section className="recommended-products" aria-labelledby="recommended-products-title">
      <div className="recommended-products-header">
        <h2 id="recommended-products-title">{title}</h2>
        <Link href="/products">View all →</Link>
      </div>
      <div className="recommended-products-grid">
        {recommendations.map((product) => {
          const imageUrl = imageFor(product);
          return (
            <article className="recommended-product-card" key={product.id}>
              <Link href={`/products/${encodeURIComponent(product.sku)}`} className="recommended-product-image">
                {imageUrl ? <CleanProductImage src={imageUrl} alt={product.name} /> : <span>{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
              </Link>
              <div className="recommended-product-body">
                <Link href={`/products/${encodeURIComponent(product.sku)}`}>
                  <small>{product.category?.name || "Product"}</small>
                  <strong>{product.name}</strong>
                </Link>
                <b>{money(product.priceMinor)}</b>
              </div>
            </article>
          );
        })}
      </div>
      <style jsx>{`
        .recommended-products { margin-top:42px; }
        .recommended-products-header { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:18px; }
        .recommended-products-header h2 { margin:0; font-size:22px; letter-spacing:-.03em; }
        .recommended-products-header a { color:#165dff; font-size:13px; font-weight:800; }
        .recommended-products-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:16px; }
        .recommended-product-card { overflow:hidden; border:1px solid var(--line); border-radius:14px; background:#fff; transition:transform .16s ease,box-shadow .16s ease; }
        .recommended-product-card:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgb(16 24 40 / .08); }
        .recommended-product-image { aspect-ratio:1.1/1; display:grid; place-items:center; background:#fafbfc; overflow:hidden; }
        .recommended-product-image img { width:100%; height:100%; object-fit:contain; padding:12px; }
        .recommended-product-image span { color:#2335ad; font-size:38px; font-weight:900; }
        .recommended-product-body { display:grid; gap:8px; padding:13px 14px 16px; }
        .recommended-product-body a { display:grid; gap:4px; color:#101828; min-width:0; text-decoration:none; }
        .recommended-product-body small { color:#667085; font-size:11px; }
        .recommended-product-body strong { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:13px; }
        .recommended-product-body b { font-size:14px; }
        @media (max-width:1100px) { .recommended-products-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width:640px) { .recommended-products-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; } }
      `}</style>
    </section>
  );
}
