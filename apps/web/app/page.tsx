import Link from "next/link";
import type { CatalogProduct } from "./catalog";
import { getCatalog } from "./catalog";

export const dynamic = "force-dynamic";

function formatMinor(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n)
    .toString()
    .padStart(2, "0")} EGP`;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link className="card product-card" href={`/products/${encodeURIComponent(product.sku)}`}>
      <div className="product-image" aria-hidden="true" />
      <p className="eyebrow">{product.sku}</p>
      <h3>{product.name}</h3>
      <p>{product.description || "Quality products selected for everyday use."}</p>
      <p className="price">{formatMinor(product.priceMinor)}</p>
    </Link>
  );
}

export default async function Home() {
  const catalog = await getCatalog();
  const ps = catalog.products.slice(0, 6);
  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/">
            Lingo Store
          </Link>
          <nav className="nav" aria-label="Main navigation">
            <Link href="/products">Products</Link>
            <Link href="/services">Services</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
      </header>

      <section className="container hero">
        <p className="eyebrow">Lingo Store · Modern retail</p>
        <h1>Quality products for your business and everyday needs.</h1>
        <p>
          Discover the catalog, compare products, and manage your orders through a fast, secure
          storefront built for Arabic and English customers.
        </p>
        <div className="actions">
          <Link className="button primary" href="/products">
            Shop products
          </Link>
          <Link className="button secondary" href="/register">
            Create account
          </Link>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-main">
            <p className="eyebrow">Trusted storefront</p>
            <h2>A simple shopping experience backed by serious store operations.</h2>
            <p>
              Transparent pricing, secure accounts, and a consistent experience across desktop and
              mobile.
            </p>
          </div>
          <div className="stat-stack">
            <div className="stat-card">
              <span className="muted">Fast delivery</span>
              <strong>24–48h</strong>
              <span className="muted">For eligible orders</span>
            </div>
            <div className="stat-card">
              <span className="muted">Support</span>
              <strong>7 days</strong>
              <span className="muted">Clear help when you need it</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>Featured products</h2>
          </div>
          <Link href="/products">View all →</Link>
        </div>
        {catalog.error ? (
          <section className="card" role="alert">
            <h3>Catalog unavailable</h3>
            <p className="muted">Featured products could not be loaded. Refresh to try again.</p>
          </section>
        ) : ps.length === 0 ? (
          <section className="card">
            <h3>Catalog is being prepared</h3>
            <p className="muted">No products are published yet. Check back soon.</p>
          </section>
        ) : (
          <div className="grid">
            {ps.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="container section">
        <div className="grid">
          <article className="card">
            <p className="eyebrow">Quality</p>
            <h3>Products you can trust</h3>
            <p className="muted">
              Clear product information and pricing make it easier to choose what fits your needs.
            </p>
          </article>
          <article className="card">
            <p className="eyebrow">Secure</p>
            <h3>Account-first checkout</h3>
            <p className="muted">
              Your customer session stays isolated from staff systems and sensitive store
              operations.
            </p>
          </article>
          <article className="card">
            <p className="eyebrow">Support</p>
            <h3>Human help when needed</h3>
            <p className="muted">
              Use the contact page for questions about products, orders, and services.
            </p>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Link className="brand" href="/">
              Lingo Store
            </Link>
            <p className="muted">A secure storefront for modern retail.</p>
          </div>
          <div>
            <h3>Shop</h3>
            <Link href="/products">Products</Link>
            <Link href="/services">Services</Link>
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
