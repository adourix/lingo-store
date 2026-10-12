import Link from "next/link";
import type { CatalogProduct } from "./catalog";
import { getCatalog } from "./catalog";
import Footer from "./Footer";

export const dynamic = "force-dynamic";

function formatMinor(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n).toString().padStart(2, "0")} EGP`;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link className="product-card" href={`/products/${encodeURIComponent(product.sku)}`}>
      <div className="product-image">
        {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
      </div>
      <div className="product-card-body">
        <div className="product-meta-row"><span className="eyebrow">{product.category?.name || "Product"}</span>{product.brand && <span className="muted">{product.brand}</span>}</div>
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <div className="product-card-footer"><strong className="price">{formatMinor(product.priceMinor)}</strong><span className="product-link">View</span></div>
      </div>
    </Link>
  );
}

function CatalogVisual({ products }: { products: CatalogProduct[] }) {
  const featured = products.filter((product) => product.imageUrl).slice(0, 4);
  const fallback = products.slice(0, 4);
  const showcase = featured.length >= 2 ? featured : fallback;
  const categories = [...new Map(products.flatMap((product) => product.category ? [[product.category.id, product.category]] : [])).values()].slice(0, 3);

  return (
    <div className="hero-products" aria-label="Featured Lingo Store products">
      <div className="hero-showcase-top">
        <span className="hero-showcase-label">FEATURED FROM THE STORE</span>
        <span className="hero-showcase-count">{products.length} {products.length === 1 ? "product" : "products"} live</span>
      </div>

      {showcase.length > 0 ? (
        <div className="hero-floating-stage">
          {showcase.map((product, index) => (
            <Link
              key={product.id}
              className={`hero-floating-product hero-floating-product-${index + 1}`}
              href={`/products/${encodeURIComponent(product.sku)}`}
              aria-label={`View ${product.name}`}
            >
              <div className="hero-floating-image">
                {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
              </div>
              <div className="hero-floating-info">
                <span>{product.category?.name || "Product"}</span>
                <strong>{product.name}</strong>
                <b>{formatMinor(product.priceMinor)}</b>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="hero-empty-showcase">
          <span className="hero-empty-mark" aria-hidden="true">L</span>
          <strong>Catalog is getting ready.</strong>
          <span>Published products will appear here.</span>
        </div>
      )}

      <div className="hero-showcase-footer">
        <div className="hero-category-pills">{categories.length > 0 ? categories.map((category) => <span key={category.id}>{category.name}</span>) : <span>Mobile phones</span>}</div>
        <Link href="/products" className="hero-visual-link">Browse all <span aria-hidden="true">→</span></Link>
      </div>
      <div className="hero-showcase-orb hero-showcase-orb-one" aria-hidden="true" />
      <div className="hero-showcase-orb hero-showcase-orb-two" aria-hidden="true" />
    </div>
  );
}

export default async function Home() {
  const catalog = await getCatalog();
  const products = catalog.products.slice(0, 6);
  const categories = [...new Map(catalog.products.flatMap((product) => product.category ? [[product.category.id, product.category]] : [])).values()].slice(0, 6);

  return (
    <main className="site-shell">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/contact">Need help?</Link><span aria-hidden="true">·</span><Link href="/login">Sign in</Link></div></div></div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link>
          <nav className="nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav>
          <div className="header-actions"><Link className="header-action" href="/products" aria-label="Browse products">Search</Link><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div>
        </div>
      </header>

      <section className="container hero hero-retail">
        <div className="hero-copy"><p className="eyebrow">LINGO MOBILE STORE · SINCE 2019</p><h1>Phones, accessories and service. All in one place.</h1><p className="hero-lede">Shop the live Lingo catalog, find the right accessories, and get the support you need for your mobile device.</p><div className="actions"><Link className="button primary" href="/products">Shop phones & accessories</Link><Link className="text-action" href="/about">Discover Lingo <span aria-hidden="true">→</span></Link></div></div>
        <CatalogVisual products={catalog.products} />
      </section>

      {!catalog.error && categories.length > 0 && <section className="category-strip" aria-label="Product categories"><div className="container category-strip-inner">{categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category.id)}`} className="category-link" key={category.id}><span>{category.name}</span><span aria-hidden="true">→</span></Link>)}</div></section>}

      <section className="container section">
        <div className="section-head"><div><p className="eyebrow">CATALOG</p><h2>Explore products</h2></div><Link className="section-link" href="/products">View all products <span aria-hidden="true">→</span></Link></div>
        {catalog.error ? <section className="state-panel" role="alert"><h3>Catalog unavailable</h3><p>Products could not be loaded right now. Refresh to try again.</p></section> : products.length === 0 ? <section className="state-panel"><h3>No products yet</h3><p>The store catalog has not published any products yet.</p></section> : <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      </section>

      <section className="container storefront-note"><div><p className="eyebrow">LINGO</p><h2>A simple path from product to order.</h2></div><div className="note-items"><div><strong>01</strong><span>Browse the catalog and compare the products available now.</span></div><div><strong>02</strong><span>Open a product to review the information provided by the store.</span></div><div><strong>03</strong><span>Add what you need to the cart and continue to checkout.</span></div></div></section>

      <Footer />
    </main>
  );
}
