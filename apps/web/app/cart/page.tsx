"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CleanProductImage from "../CleanProductImage";
import Footer from "../Footer";
import Header from "../Header";
import { parseProductDescription } from "../product-meta";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const CART_KEY = "lingo-cart-v1";
type CartLine = { productId: string; quantity: number };
type Product = {
  id: string;
  name: string;
  sku: string;
  priceMinor: string | number;
  description: string | null;
  stock?: number | string | null;
  category?: { id: string; name: string } | null;
  brand?: string | null;
};
type ProductView = Product & { imageUrl: string | null };

function formatMinor(value: string | number): string {
  const amount = BigInt(value);
  return `${new Intl.NumberFormat("en").format(amount / 100n)}.${(amount % 100n).toString().padStart(2, "0")} EGP`;
}

function validCart(value: unknown): value is CartLine[] {
  return Array.isArray(value) && value.every((item) => Boolean(item) && typeof item === "object" && "productId" in item && typeof item.productId === "string" && "quantity" in item && typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 999);
}

function toProductView(product: Product): ProductView {
  const meta = parseProductDescription(product.description);
  return { ...product, imageUrl: meta.imageUrl };
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function productTokens(product: Product): Set<string> {
  return new Set(
    `${product.name} ${product.brand || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function recommendationScore(candidate: Product, cartProducts: Product[]): number {
  const candidateTokens = productTokens(candidate);
  return Math.max(
    ...cartProducts.map((item) => {
      const sameCategory = Boolean(candidate.category?.id && item.category?.id && String(candidate.category.id) === String(item.category.id));
      const sameBrand = Boolean(candidate.brand && item.brand && normalize(candidate.brand) === normalize(item.brand));
      const overlap = [...candidateTokens].filter((token) => productTokens(item).has(token)).length;
      const candidatePrice = Number(candidate.priceMinor);
      const itemPrice = Number(item.priceMinor);
      const priceSimilarity = Number.isFinite(candidatePrice) && Number.isFinite(itemPrice) && itemPrice > 0
        ? Math.max(0, 15 - Math.round((Math.abs(candidatePrice - itemPrice) / itemPrice) * 15))
        : 0;
      return (sameCategory ? 60 : 0) + (sameBrand ? 30 : 0) + Math.min(20, overlap * 10) + priceSimilarity;
    }),
  );
}

export default function CartPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
      if (validCart(parsed)) setCart(parsed);
    } catch {
      setCart([]);
    }

    fetch(API + "/public/products", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Catalog unavailable.");
        const body: unknown = await r.json();
        if (!Array.isArray(body)) throw new Error("Invalid catalog response.");
        setProducts((body as Product[]).map(toProductView));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load cart."))
      .finally(() => setLoading(false));
  }, []);

  const catalog = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);
  const total = cart.reduce((sum, line) => {
    const p = catalog.get(String(line.productId));
    return p ? sum + BigInt(p.priceMinor) * BigInt(line.quantity) : sum;
  }, 0n);

  const relatedProducts = useMemo(() => {
    const cartProducts = cart.map((line) => catalog.get(String(line.productId))).filter((product): product is ProductView => Boolean(product));
    if (cartProducts.length === 0) return [];

    const cartIds = new Set(cart.map((line) => String(line.productId)));
    const cartSkus = new Set(cartProducts.map((product) => normalize(product.sku)));
    const cartNames = new Set(cartProducts.map((product) => normalize(product.name)));

    return products
      .filter((product) => !cartIds.has(String(product.id)))
      .filter((product) => !cartSkus.has(normalize(product.sku)))
      .filter((product) => !cartNames.has(normalize(product.name)))
      .filter((product) => product.stock === null || product.stock === undefined || Number(product.stock) > 0)
      .map((product) => ({ product, score: recommendationScore(product, cartProducts) }))
      .filter(({ score }) => score >= 60)
      .sort((a, b) => b.score - a.score || Number(a.product.priceMinor) - Number(b.product.priceMinor))
      .slice(0, 5)
      .map(({ product }) => product);
  }, [cart, catalog, products]);

  function save(next: CartLine[]) {
    setCart(next);
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("lingo-cart-updated"));
  }

  return (
    <main className="site-shell cart-page">
      <Header />

      <section className="container cart-section">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Cart</span></nav>

        <div className="cart-heading">
          <div><p className="eyebrow">SHOPPING BAG</p><h1>Your cart</h1><p className="muted">Review your items before continuing to checkout.</p></div>
          <Link className="button secondary" href="/products">← Continue shopping</Link>
        </div>

        {loading ? <section className="cart-card"><p role="status">Loading cart…</p></section> : error ? <section className="cart-card" role="alert"><h2>Cart unavailable</h2><p className="muted">{error}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></section> : cart.length === 0 ? <section className="cart-card cart-empty"><h2>Your cart is empty</h2><p className="muted">Add products from the catalog and they will appear here.</p><Link className="button primary" href="/products">Browse products</Link></section> : (
          <div className="cart-layout">
            <section className="cart-card cart-items-card">
              <div className="cart-card-header"><h2>Items ({cart.length})</h2><button type="button" className="clear-cart" onClick={() => save([])}>Clear cart</button></div>
              <ul className="cart-items">
                {cart.map((line) => {
                  const p = catalog.get(String(line.productId));
                  return (
                    <li key={line.productId} className="cart-item">
                      <div className="cart-item-image">
                        {p?.imageUrl ? <CleanProductImage src={p.imageUrl} alt={p.name} /> : <span>{p?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
                      </div>
                      <div className="cart-item-info">
                        <Link href={`/products/${encodeURIComponent(p?.sku || line.productId)}`} className="cart-item-name">{p?.name || "Unavailable product"}</Link>
                        {p?.sku && <span className="cart-item-sku">SKU: {p.sku}</span>}
                        {p && <span className={`cart-stock ${p.stock === null || p.stock === undefined || Number(p.stock) > 0 ? "in-stock" : "out-stock"}`}>{p.stock === null || p.stock === undefined || Number(p.stock) > 0 ? "✓ In Stock" : "Out of stock"}</span>}
                        <strong>{p ? formatMinor(p.priceMinor) : "Unavailable"}</strong>
                      </div>
                      <div className="cart-quantity-wrap"><span>Quantity</span><div className="cart-quantity"><button type="button" onClick={() => save(cart.map((x) => String(x.productId) === String(line.productId) ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} disabled={line.quantity <= 1} aria-label="Decrease quantity">−</button><strong>{line.quantity}</strong><button type="button" onClick={() => save(cart.map((x) => String(x.productId) === String(line.productId) ? { ...x, quantity: Math.min(999, x.quantity + 1) } : x))} aria-label="Increase quantity">+</button></div></div>
                      <div className="cart-line-total">
                        {p ? formatMinor((BigInt(p.priceMinor) * BigInt(line.quantity)).toString()) : "—"}
                        <button type="button" className="remove-item" aria-label={`Remove ${p?.name || "item"}`} title="Remove item" onClick={() => save(cart.filter((x) => String(x.productId) !== String(line.productId)))}>
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside className="cart-summary">
              <h2>Order summary</h2>
              <div className="summary-row"><span>Subtotal ({cart.length} {cart.length === 1 ? "item" : "items"})</span><strong>{formatMinor(total.toString())}</strong></div>
              <div className="summary-divider" />
              <span className="summary-label">Estimated total</span>
              <strong className="summary-total">{formatMinor(total.toString())}</strong>
              <p>The server recalculates current prices and stock at checkout.</p>
              <Link className="button primary summary-checkout" href="/checkout">Continue to checkout</Link>
            </aside>
          </div>
        )}

        {relatedProducts.length > 0 && (
          <section className="cart-related" aria-labelledby="cart-related-title">
            <div className="cart-related-header"><h2 id="cart-related-title">You may also like</h2><Link href="/products">View all →</Link></div>
            <div className="cart-related-grid">
              {relatedProducts.map((product) => (
                <article className="cart-related-card" key={product.id}>
                  <Link href={`/products/${encodeURIComponent(product.sku)}`} className="cart-related-image">
                    {product.imageUrl ? <CleanProductImage src={product.imageUrl} alt={product.name} /> : <span>{product.category?.name?.slice(0, 1) || "L"}</span>}
                  </Link>
                  <div className="cart-related-body"><Link href={`/products/${encodeURIComponent(product.sku)}`}><small>{product.category?.name || "Product"}</small><strong>{product.name}</strong></Link><b>{formatMinor(product.priceMinor)}</b></div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>

      <Footer />

      <style jsx>{`
        .cart-section { padding: 38px 0 74px; }
        .cart-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:28px; }
        .cart-heading h1 { margin:6px 0 8px; font-size:clamp(40px,5vw,54px); line-height:1; letter-spacing:-.055em; }
        .cart-card,.cart-summary { border:1px solid var(--line); border-radius:14px; background:#fff; box-shadow:var(--shadow-sm); }
        .cart-card { padding:22px; }
        .cart-layout { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(310px,.65fr); gap:22px; align-items:start; }
        .cart-summary { padding:26px; position:sticky; top:96px; }
        .cart-summary h2 { margin:0 0 24px; font-size:21px; letter-spacing:-.025em; }
        .summary-row { display:flex; justify-content:space-between; gap:16px; color:#475467; font-size:14px; }
        .summary-row strong { color:#101828; }
        .summary-divider { height:1px; background:var(--line); margin:22px 0; }
        .summary-label { display:block; color:#667085; font-size:14px; margin-bottom:5px; }
        .summary-total { display:block; font-size:25px; letter-spacing:-.035em; }
        .cart-summary p { color:var(--muted); font-size:13px; line-height:1.55; margin:8px 0 20px; }
        .summary-checkout { width:100%; min-height:50px; }
        .cart-card-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:4px 0 18px; border-bottom:1px solid var(--line); }
        .cart-card-header h2 { margin:0; font-size:20px; }
        .clear-cart { border:0; background:none; color:#475467; font-weight:700; font-size:13px; padding:8px; cursor:pointer; }
        .clear-cart:hover { color:var(--lingo-blue); }
        .cart-items { list-style:none; padding:0; margin:0; }
        .cart-item { display:grid; grid-template-columns:150px minmax(180px,1fr) 175px 120px; gap:18px; align-items:center; padding:22px 0; border-bottom:1px solid var(--line); }
        .cart-item:last-child { border-bottom:0; padding-bottom:2px; }
        .cart-item-image { width:150px; height:128px; display:grid; place-items:center; border-radius:10px; background:#f8f9fb; overflow:hidden; }
        .cart-item-image .clean-product-image,.cart-related-image .clean-product-image { width:100%; height:100%; }
        .cart-item-image img,.cart-related-image img { width:100%; height:100%; object-fit:contain; padding:12px; }
        .cart-item-image span,.cart-related-image > span { color:var(--lingo-blue); font-size:38px; font-weight:900; }
        .cart-item-info { display:grid; gap:6px; min-width:0; }
        .cart-item-name { font-size:18px; font-weight:800; color:#101828; }
        .cart-item-name:hover { color:var(--lingo-blue); }
        .cart-item-sku { color:#667085; font-size:13px; }
        .cart-stock { width:max-content; padding:5px 10px; border-radius:999px; font-size:11px; font-weight:800; }
        .in-stock { color:#087443; background:#eaf8ef; }
        .out-stock { color:#b42318; background:#fff1f0; }
        .cart-item-info > strong { font-size:14px; }
        .cart-quantity-wrap { display:grid; gap:7px; justify-items:start; color:#667085; font-size:12px; }
        .cart-quantity { height:46px; display:grid; grid-template-columns:42px 48px 42px; border:1px solid #d0d5dd; border-radius:9px; overflow:hidden; background:#fff; }
        .cart-quantity button { border:0; background:#fff; font-size:18px; color:#101828; cursor:pointer; }
        .cart-quantity button:hover:not(:disabled) { background:#f8f9fb; }
        .cart-quantity button:disabled { color:#98a2b3; cursor:not-allowed; }
        .cart-quantity strong { display:grid; place-items:center; border-inline:1px solid var(--line); font-size:13px; color:#101828; }
        .cart-line-total { display:grid; justify-items:end; gap:13px; color:#101828; font-size:14px; font-weight:800; }
        .remove-item { display:grid; place-items:center; width:34px; height:34px; border:0; border-radius:8px; background:transparent; color:#667085; cursor:pointer; }
        .remove-item:hover,.remove-item:focus-visible { color:#b42318; background:#fff1f0; outline:none; }
        .cart-empty { text-align:center; padding:58px 24px; }
        .cart-empty h2 { margin:0 0 8px; }
        .cart-empty p { margin:0 0 22px; }
        .cart-related { margin-top:42px; }
        .cart-related-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
        .cart-related-header h2 { margin:0; font-size:22px; letter-spacing:-.03em; }
        .cart-related-header a { color:#165dff; font-size:13px; font-weight:800; }
        .cart-related-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:16px; }
        .cart-related-card { overflow:hidden; border:1px solid var(--line); border-radius:12px; background:#fff; transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease; }
        .cart-related-card:hover { transform:translateY(-2px); border-color:#c8d1e8; box-shadow:0 12px 28px rgb(16 24 40 / .08); }
        .cart-related-image { aspect-ratio:1.12/1; display:grid; place-items:center; background:#fafbfc; overflow:hidden; }
        .cart-related-image img { padding:12px; }
        .cart-related-body { display:grid; gap:7px; padding:13px 14px 16px; }
        .cart-related-body a { display:grid; gap:4px; color:#101828; min-width:0; }
        .cart-related-body small { color:#667085; font-size:11px; }
        .cart-related-body strong { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:13px; }
        .cart-related-body b { font-size:14px; }
        @media (max-width:1100px) { .cart-layout { grid-template-columns:1fr; } .cart-summary { position:static; } .cart-item { grid-template-columns:120px 1fr auto; } .cart-item-image { width:120px; height:112px; } .cart-line-total { grid-column:3; grid-row:1; } .cart-quantity-wrap { grid-column:2; } .cart-related-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width:640px) { .cart-section { padding-top:28px; } .cart-heading { align-items:flex-start; flex-direction:column; } .cart-heading .button { width:100%; } .cart-item { grid-template-columns:88px 1fr; gap:13px; } .cart-item-image { width:88px; height:88px; grid-row:span 2; } .cart-quantity-wrap { grid-column:2; } .cart-line-total { grid-column:2; grid-row:auto; justify-items:start; } .cart-related-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      `}</style>
    </main>
  );
}
