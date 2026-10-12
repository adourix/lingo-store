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
  const formatted = formatMinor(value);
  const [amount, ...currency] = formatted.split(" ");
  return { amount, currency: currency.join(" ") };
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
            <p>
              {catalog.error
                ? "The catalog could not be loaded right now. Please try again."
                : "This product may have been archived or is no longer published."}
            </p>
            <Link className="button primary" href="/products">
              Back to products
            </Link>
          </section>
        </section>
      </main>
    );
  }

  const available = p.stock === null || p.stock > 0;
  const price = formatPriceParts(p.priceMinor);
  const description = p.description || "A quality product selected for the Lingo Store catalog.";

  return (
    <main className="site-shell">
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Lingo Store</span>
          <div>
            <Link href="/contact">Need help?</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Lingo Store home">
            <img src="/lingo-logo.svg" alt="Lingo" />
          </Link>
          <nav className="nav" aria-label="Product navigation">
            <Link href="/">Home</Link>
            <Link href="/products">Shop</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Support</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-action" href="/products">
              Search
            </Link>
            <Link className="header-action" href="/account">
              Account
            </Link>
            <Link className="header-cart" href="/cart">
              Cart
            </Link>
          </div>
        </div>
      </header>

      <section className={`container ${styles.page}`}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className={styles.separator} aria-hidden="true">
            /
          </span>
          <Link href="/products">Products</Link>
          <span className={styles.separator} aria-hidden="true">
            /
          </span>
          <span className={styles.breadcrumbCurrent}>{p.name}</span>
        </nav>

        <div className={styles.productGrid}>
          <div className={styles.imageFrame}>
            {p.imageUrl ? (
              <CleanProductImage src={p.imageUrl} alt={p.name} />
            ) : (
              <span className={styles.placeholder} aria-hidden="true">
                {p.category?.name?.slice(0, 1).toUpperCase() || "L"}
              </span>
            )}
          </div>

          <article className={styles.info}>
            <span className={styles.category}>{p.category?.name || "Product"}</span>
            <h1 className={styles.title}>{p.name}</h1>
            {p.brand && <p className={styles.brand}>Brand: {p.brand}</p>}
            <p className={styles.description}>{description}</p>

            <div className={styles.priceBlock} aria-label={`Price ${price.amount} ${price.currency}`}>
              <span className={styles.price}>{price.amount}</span>
              <span className={styles.currency}>{price.currency}</span>
            </div>

            <div className={styles.meta} aria-label="Product information">
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>SKU</span>
                <span className={styles.metaValue}>{p.sku}</span>
              </div>
              {p.unit && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Unit</span>
                  <span className={styles.metaValue}>{p.unit}</span>
                </div>
              )}
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Availability</span>
                <span className={`${styles.metaValue} ${available ? styles.available : styles.unavailable}`}>
                  {available ? "Available" : "Out of stock"}
                </span>
              </div>
            </div>

            <div className={styles.purchaseArea}>
              {available ? (
                <AddToCartButton productId={p.id} />
              ) : (
                <p className={styles.outOfStock} role="status">
                  This product is currently out of stock.
                </p>
              )}
            </div>
          </article>
        </div>

        <section className={styles.detailSection} aria-labelledby="product-description-title">
          <div className={styles.detailHeader}>
            <h2 id="product-description-title">Product details</h2>
            <p>Information provided by the Lingo Store catalog.</p>
          </div>
          <div className={styles.descriptionPanel}>
            <p>{description}</p>
          </div>
        </section>
      </section>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <img className="footer-logo" src="/lingo-logo.svg" alt="Lingo" />
            <p className="muted">Lingo Store customer storefront.</p>
          </div>
          <div>
            <h3>Shop</h3>
            <Link href="/products">Products</Link>
            <Link href="/cart">Cart</Link>
          </div>
          <div>
            <h3>Company</h3>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div>
            <h3>Account</h3>
            <Link href="/login">Sign in</Link>
            <Link href="/register">Create account</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
