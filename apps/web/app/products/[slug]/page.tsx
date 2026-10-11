import Link from "next/link";
import AddToCartButton from "../AddToCartButton";
import { getCatalog } from "../../catalog";
export const dynamic = "force-dynamic";

function formatMinor(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n)
    .toString()
    .padStart(2, "0")} EGP`;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const p = catalog.products.find((x) => x.sku === decodeURIComponent(slug));
  if (catalog.error || !p)
    return (
      <main className="site-shell">
        <section className="container section">
          <section className="card" role="alert">
            <h1>{catalog.error ? "Product unavailable" : "Product not found"}</h1>
            <p className="muted">
              {catalog.error
                ? "The catalog could not be loaded right now. Please try again."
                : "This product may have been archived or is no longer published."}
            </p>
            <Link className="button primary" href="/products">Back to products</Link>
          </section>
        </section>
      </main>
    );
  const available = p.stock === null || p.stock > 0;
  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/">Lingo Store</Link>
          <nav className="nav" aria-label="Product navigation">
            <Link href="/products">Products</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </header>
      <section className="container section">
        <div className="breadcrumbs">
          <Link href="/">Home</Link> / <Link href="/products">Products</Link> / {p.name}
        </div>
        <div className="detail-layout">
          <div className="detail-image">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} />
            ) : (
              <span className="detail-image-placeholder">
                {p.category?.name?.slice(0, 1).toUpperCase() || "L"}
              </span>
            )}
          </div>
          <article className="detail-copy">
            <p className="eyebrow">{p.category?.name || "Product"}</p>
            <h1>{p.name}</h1>
            {p.brand && <p className="muted">Brand: {p.brand}</p>}
            <p className="muted" style={{ fontSize: 18, lineHeight: 1.7 }}>
              {p.description || "A quality product selected for the Lingo Store catalog."}
            </p>
            <p className="price">{formatMinor(p.priceMinor)}</p>
            <div className="info-list">
              <div className="info-row">
                <span className="muted">SKU</span>
                <strong>{p.sku}</strong>
              </div>
              {p.unit && (
                <div className="info-row">
                  <span className="muted">Unit</span>
                  <strong>{p.unit}</strong>
                </div>
              )}
              <div className="info-row">
                <span className="muted">Availability</span>
                <strong className={`catalog-availability ${available ? "in-stock" : "out-of-stock"}`}>
                  {available ? "Available" : "Out of stock"}
                </strong>
              </div>
            </div>
            {available ? (
              <AddToCartButton productId={p.id} />
            ) : (
              <p className="error" role="status">This product is currently out of stock.</p>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
