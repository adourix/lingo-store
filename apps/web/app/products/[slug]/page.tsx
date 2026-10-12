import Link from "next/link";
import AddToCartButton from "../AddToCartButton";
import CleanProductImage from "../../CleanProductImage";
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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const p = catalog.products.find((x) => x.sku === decodeURIComponent(slug));

  if (catalog.error || !p) {
    return (
      <main className="site-shell">
        <section className={`container ${styles.errorPage}`}>
          <section className={styles.errorCard} role="alert">
            <h1>{catalog.error ? "Product unavailable" : "Product not found"}</h1>
            <p>{catalog.error ? "The catalog could not be loaded right now. Please try again." : "This product may have been archived or is no longer published."}</p>
            <Link className="button primary" href="/products">Back to products</Link>
          </section>
        </section>
      </main>
    );
  }

  const available = p.stock === null || p.stock > 0;
  const price = formatPriceParts(p.priceMinor);
  const description = p.description || "";
  const categoryName = p.category?.name || "Product";

  const related = catalog.products
    .filter((product) => product.id !== p.id)
    .filter((product) => product.stock === null || product.stock > 0)
    .map((product) => {
      const sameCategory = Boolean(p.category?.id && product.category?.id === p.category.id);
      const sameBrand = Boolean(p.brand && product.brand && product.brand.toLowerCase() === p.brand.toLowerCase());
      return { product, score: (sameCategory ? 100 : 0) + (sameBrand ? 50 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ product }) => product);

  return (
    <main className="site-shell">
      <div className={styles.referenceUtility}>
        <div className={styles.referenceUtilityInner}>
          <span>Shop Lingo Store</span>
          <div><Link href="/contact">Need help?</Link><Link href="/products">Shop</Link><span className={styles.utilityDivider} /><span>EGP</span></div>
        </div>
      </div>

      <header className={styles.referenceHeader}>
        <div className={styles.referenceHeaderInner}>
          <Link className={styles.referenceBrand} href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link>
          <nav className={styles.referenceNav} aria-label="Main navigation">
            <Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link>
          </nav>
          <div className={styles.referenceActions}>
            <form className={styles.referenceSearch} action="/products">
              <input name="q" placeholder="Search for products, brands and more..." aria-label="Search products" />
              <button type="submit" aria-label="Search"><Icon name="search" /></button>
            </form>
            <Link className={styles.referenceAccount} href="/account"><Icon name="user" /><span>Account</span></Link>
            <Link className={styles.referenceCart} href="/cart"><Icon name="cart" /></Link>
          </div>
        </div>
      </header>

      <section className={styles.referencePage}>
        <nav className={styles.referenceBreadcrumbs} aria-label="Breadcrumb">
          <Link href="/">⌂&nbsp; Home</Link><span>›</span><Link href="/categories">{categoryName}</Link><span>›</span><strong>{p.name}</strong>
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
              <div><Icon name="shield" /><span><small>Availability</small><strong className={available ? styles.green : styles.red}>{available ? "Available" : "Out of stock"}</strong></span></div>
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

      <footer className="site-footer">
        <div className="container footer-grid">
          <div><img className="footer-logo" src="/lingo-logo.svg" alt="Lingo" /><p className="muted">Lingo Store customer storefront.</p></div>
          <div><h3>Shop</h3><Link href="/products">Products</Link><Link href="/cart">Cart</Link></div>
          <div><h3>Company</h3><Link href="/about">About</Link><Link href="/contact">Contact</Link></div>
          <div><h3>Account</h3><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></div>
        </div>
      </footer>
    </main>
  );
}
