import Link from "next/link";
import AddToCartButton from "../AddToCartButton";
import CleanProductImage from "../../CleanProductImage";
import Footer from "../../Footer";
import Header from "../../Header";
import { getCatalog } from "../../catalog";
import styles from "../ProductDetail.module.css";

export const dynamic = "force-dynamic";

function formatMinor(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n).toString().padStart(2, "0")} EGP`;
}

function formatPriceParts(value: string | number): { amount: string; currency: string } {
  const [amount, ...currency] = formatMinor(value).split(" ");
  return { amount, currency: currency.join(" ") };
}

function Icon({ name }: { name: "search" | "user" | "cart" | "truck" | "shield" | "refresh" | "headset" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.9-3.2 3.3-5 7-5s6.1 1.8 7 5" /></svg>;
  if (name === "cart") return <svg {...common}><path d="M3 4h2l2 11h10l2-8H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>;
  if (name === "truck") return <svg {...common}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 11a8 8 0 0 0-14.8-4L3 9" /><path d="M3 4v5h5M4 13a8 8 0 0 0 14.8 4L21 15" /><path d="M21 20v-5h-5" /></svg>;
  return <svg {...common}><path d="M4 17v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2" /><path d="M7 17v2M17 17v2" /><path d="M9 10a3 3 0 1 1 6 0" /></svg>;
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

type ProductPlaceholder = Awaited<ReturnType<typeof getCatalog>>["products"][number];

function productTokens(product: { name: string; brand?: string | null }): Set<string> {
  return new Set(`${product.name} ${product.brand || ""}`.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").split(/\s+/).filter((token) => token.length >= 3));
}

function relatedScore(candidate: ProductPlaceholder, current: ProductPlaceholder): number {
  const sameCategory = Boolean(candidate.category?.id && current.category?.id && String(candidate.category.id) === String(current.category.id));
  const sameBrand = Boolean(candidate.brand && current.brand && normalize(candidate.brand) === normalize(current.brand));
  const overlap = [...productTokens(candidate)].filter((token) => productTokens(current).has(token)).length;
  const candidatePrice = Number(candidate.priceMinor);
  const currentPrice = Number(current.priceMinor);
  const priceSimilarity = Number.isFinite(candidatePrice) && Number.isFinite(currentPrice) && currentPrice > 0
    ? Math.max(0, 15 - Math.round((Math.abs(candidatePrice - currentPrice) / currentPrice) * 15))
    : 0;
  return (sameCategory ? 60 : 0) + (sameBrand ? 30 : 0) + Math.min(20, overlap * 10) + priceSimilarity;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const p = catalog.products.find((x) => x.sku === decodeURIComponent(slug));

  if (catalog.error || !p) {
    return (
      <main className="site-shell">
        <Header />
        <section className={`container ${styles.errorPage}`}>
          <section className={styles.errorCard} role="alert">
            <h1>{catalog.error ? "Product unavailable" : "Product not found"}</h1>
            <p>{catalog.error ? "The catalog could not be loaded right now. Please try again." : "This product may have been archived or is no longer published."}</p>
            <Link className="button primary" href="/products">Back to products</Link>
          </section>
        </section>
        <Footer />
      </main>
    );
  }

  const available = p.stock === null || p.stock > 0;
  const price = formatPriceParts(p.priceMinor);
  const description = p.description || "";
  const categoryName = p.category?.name || "Product";

  const related = catalog.products
    .filter((product) => String(product.id) !== String(p.id))
    .filter((product) => normalize(product.sku) !== normalize(p.sku))
    .filter((product) => normalize(product.name) !== normalize(p.name))
    .filter((product) => product.stock === null || product.stock > 0)
    .map((product) => ({ product, score: relatedScore(product, p) }))
    .filter(({ score }) => score >= 60)
    .sort((a, b) => b.score - a.score || Number(a.product.priceMinor) - Number(b.product.priceMinor))
    .slice(0, 4)
    .map(({ product }) => product);

  return (
    <main className="site-shell">
      <Header />

      <section className={styles.referencePage}>
        <nav className={styles.referenceBreadcrumbs} aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>›</span><Link href="/categories">{categoryName}</Link><span>›</span><strong>{p.name}</strong>
        </nav>

        <div className={styles.referenceProductGrid}>
          <div className={styles.referenceImageFrame}>
            {p.imageUrl ? <CleanProductImage src={p.imageUrl} alt={p.name} /> : <span className={styles.placeholder}>{categoryName.slice(0, 1).toUpperCase()}</span>}
          </div>

          <article className={styles.referenceInfo}>
            <div className={styles.referenceInfoTop}>
              <span className={styles.referenceCategory}>{categoryName}</span>
              {available ? <span className={styles.stockPill}>✓&nbsp; In Stock</span> : <span className={`${styles.stockPill} ${styles.stockPillOut}`}>Out of stock</span>}
            </div>
            <h1>{p.name}</h1>
            {description && <p className={styles.referenceDescription}>{description}</p>}
            <div className={styles.referencePrice}><strong>{price.amount}</strong><span>{price.currency}</span></div>

            <div className={styles.referenceMeta}>
              <div><Icon name="shield" /><span><small>SKU</small><strong>{p.sku}</strong></span></div>
              <div><Icon name="truck" /><span><small>Availability</small><strong className={available ? styles.green : styles.red}>{available ? "Available" : "Out of stock"}</strong></span></div>
            </div>

            {available ? <AddToCartButton productId={p.id} /> : <p className={styles.outOfStock}>This product is currently out of stock.</p>}
          </article>
        </div>

        <section className={styles.referenceDetails} aria-labelledby="product-description-title">
          <div className={styles.referenceTabs}><span className={styles.activeTab}>Description</span></div>
          <div className={styles.referenceDescriptionPanel}><p id="product-description-title">{description || "No description is available for this product."}</p></div>
        </section>

        {related.length > 0 && (
          <section className={styles.relatedSection} aria-labelledby="related-products-title">
            <div className={styles.relatedHeader}><h2 id="related-products-title">Related Products</h2><Link href="/products">View all&nbsp; →</Link></div>
            <div className={styles.relatedGrid}>
              {related.map((product) => {
                const relatedPrice = formatPriceParts(product.priceMinor);
                return <Link key={product.id} href={`/products/${encodeURIComponent(product.sku)}`} className={styles.relatedCard}>
                  <div className={styles.relatedImage}>{product.imageUrl ? <CleanProductImage src={product.imageUrl} alt={product.name} /> : <span>{product.category?.name?.slice(0, 1) || "L"}</span>}</div>
                  <div><small>{product.category?.name || "Product"}</small><strong>{product.name}</strong><b>{relatedPrice.amount} {relatedPrice.currency}</b></div>
                </Link>;
              })}
            </div>
          </section>
        )}
      </section>

      <Footer />
    </main>
  );
}
