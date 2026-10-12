import Link from "next/link";
import type { CatalogProduct } from "./catalog";
import { getCatalog } from "./catalog";
import Footer from "./Footer";
import CleanProductImage from "./CleanProductImage";

export const dynamic = "force-dynamic";

function formatMinor(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n).toString().padStart(2, "0")} EGP`;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link className="product-card" href={`/products/${encodeURIComponent(product.sku)}`}>
      <div className="product-image">
        {product.imageUrl ? <CleanProductImage src={product.imageUrl} alt="" /> : <span>{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
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

function categoryPriority(product: CatalogProduct): number {
  const name = product.category?.name?.toLowerCase() || "";
  if (name.includes("mobile") || name.includes("phone") || name.includes("smartphone")) return 0;
  if (name.includes("accessor") || name.includes("headphone") || name.includes("audio")) return 1;
  return 2;
}

function CatalogVisual({ products }: { products: CatalogProduct[] }) {
  const featured = [...products].sort((a, b) => categoryPriority(a) - categoryPriority(b))[0];
  const categories = [...new Map(products.flatMap((product) => product.category ? [[product.category.id, product.category]] : [])).values()].slice(0, 3);

  return (
    <div className="hero-stage" aria-label="Featured Lingo Store product">
      <div className="hero-available-now">
        <span>
          <strong>Available now</strong>
          <small>Browse our latest products</small>
        </span>
        <Link href="/products" aria-label="Browse latest products">→</Link>
      </div>

      <div className="hero-stage-orbit hero-stage-orbit-main" aria-hidden="true" />
      <div className="hero-stage-orbit hero-stage-orbit-soft" aria-hidden="true" />
      <div className="hero-stage-dot hero-stage-dot-one" aria-hidden="true" />
      <div className="hero-stage-dot hero-stage-dot-two" aria-hidden="true" />
      <div className="hero-stage-grid" aria-hidden="true" />

      {featured ? (
        <Link className="hero-featured-product" href={`/products/${encodeURIComponent(featured.sku)}`} aria-label={`View ${featured.name}`}>
          <div className="hero-featured-image">
            {featured.imageUrl ? <CleanProductImage src={featured.imageUrl} alt="" /> : <span>{featured.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
          </div>
          <div className="hero-featured-info">
            <span>PRODUCT</span>
            <strong>{featured.name}</strong>
            <b>{formatMinor(featured.priceMinor)}</b>
          </div>
        </Link>
      ) : (
        <div className="hero-empty-showcase"><span className="hero-empty-mark" aria-hidden="true">L</span><strong>Catalog is getting ready.</strong><span>Published products will appear here.</span></div>
      )}

      <div className="hero-showcase-footer">
        <div className="hero-category-pills">{categories.length > 0 ? categories.map((category) => <span key={category.id}>{category.name}</span>) : <span>Mobile phones</span>}</div>
        <Link href="/products" className="hero-visual-link">Browse all <span aria-hidden="true">→</span></Link>
      </div>
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
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/products" aria-label="Browse products">Search</Link><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header>

      <section className="container hero hero-retail">
        <div className="hero-copy">
          <p className="hero-kicker">Lingo Mobile Store</p>
          <h1>Everything your phone needs<span className="hero-title-dot">.</span></h1>
          <p className="hero-lede">Mobile phones, accessories and maintenance in one place.</p>
          <div className="hero-feature-list">
            <span><b aria-hidden="true">▣</b><strong>Mobile Phones</strong><small>Latest devices</small></span>
            <span><b aria-hidden="true">◉</b><strong>Accessories</strong><small>All the essentials</small></span>
            <span><b aria-hidden="true">⌁</b><strong>Maintenance</strong><small>Expert support</small></span>
          </div>
          <div className="actions"><Link className="button primary" href="/products">Shop phones <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/products">Explore catalog</Link></div>
          <div className="hero-stats"><span><strong>{catalog.products.length || 0}</strong><small>Products</small></span><span><strong>{categories.length || 0}</strong><small>Categories</small></span><span><strong>2019</strong><small>Since</small></span></div>
        </div>
        <CatalogVisual products={catalog.products} />
      </section>

      {!catalog.error && categories.length > 0 && <section className="category-strip" aria-label="Product categories"><div className="container category-strip-inner">{categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category.id)}`} className="category-link" key={category.id}><span>{category.name}</span><span aria-hidden="true">→</span></Link>)}</div></section>}
      <section className="container section"><div className="section-head"><div><p className="eyebrow">CATALOG</p><h2>Explore products</h2></div><Link className="section-link" href="/products">View all products <span aria-hidden="true">→</span></Link></div>{catalog.error ? <section className="state-panel" role="alert"><h3>Catalog unavailable</h3><p>Products could not be loaded right now. Refresh to try again.</p></section> : products.length === 0 ? <section className="state-panel"><h3>No products yet</h3><p>The store catalog has not published any products yet.</p></section> : <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}</section>
      <section className="container storefront-note"><div><p className="eyebrow">LINGO</p><h2>A simple path from product to order.</h2></div><div className="note-items"><div><strong>01</strong><span>Browse the catalog and compare the products available now.</span></div><div><strong>02</strong><span>Open a product to review the information provided by the store.</span></div><div><strong>03</strong><span>Add what you need to the cart and continue to checkout.</span></div></div></section>
      <Footer />
    </main>
  );
}
