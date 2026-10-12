import Link from "next/link";
import type { CatalogProduct } from "./catalog";
import { getCatalog } from "./catalog";

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
  const categories = [...new Map(products.flatMap((product) => product.category ? [[product.category.id, product.category]] : [])).values()].slice(0, 3);
  return (
    <div className="hero-products" aria-label="Lingo Store catalog overview">
      <div className="hero-brand-panel">
        <div className="hero-brand-lockup"><span className="hero-brand-dot" aria-hidden="true" /><span>Lingo Store</span></div>
        <p className="hero-visual-eyebrow">LIVE CATALOG</p>
        <strong>{products.length}</strong>
        <span>{products.length === 1 ? "product available" : "products available"}</span>
        {categories.length > 0 && <div className="hero-category-pills">{categories.map((category) => <span key={category.id}>{category.name}</span>)}</div>}
        <Link href="/products" className="hero-visual-link">Browse catalog <span aria-hidden="true">→</span></Link>
      </div>
      <div className="hero-shape hero-shape-blue" aria-hidden="true" />
      <div className="hero-shape hero-shape-orange" aria-hidden="true" />
      <div className="hero-grid-lines" aria-hidden="true" />
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
        <div className="hero-copy"><p className="eyebrow">LINGO STORE</p><h1>Products that fit the way you shop.</h1><p className="hero-lede">Browse the live Lingo catalog, open a product for the details, and order from a storefront built for a straightforward shopping experience.</p><div className="actions"><Link className="button primary" href="/products">Shop the catalog</Link><Link className="text-action" href="/cart">View cart <span aria-hidden="true">→</span></Link></div></div>
        <CatalogVisual products={catalog.products} />
      </section>

      {!catalog.error && categories.length > 0 && <section className="category-strip" aria-label="Product categories"><div className="container category-strip-inner">{categories.map((category) => <Link href={`/products?category=${encodeURIComponent(category.id)}`} className="category-link" key={category.id}><span>{category.name}</span><span aria-hidden="true">→</span></Link>)}</div></section>}

      <section className="container section">
        <div className="section-head"><div><p className="eyebrow">CATALOG</p><h2>Explore products</h2></div><Link className="section-link" href="/products">View all products <span aria-hidden="true">→</span></Link></div>
        {catalog.error ? <section className="state-panel" role="alert"><h3>Catalog unavailable</h3><p>Products could not be loaded right now. Refresh to try again.</p></section> : products.length === 0 ? <section className="state-panel"><h3>No products yet</h3><p>The store catalog has not published any products yet.</p></section> : <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      </section>

      <section className="container storefront-note"><div><p className="eyebrow">LINGO</p><h2>A simple path from product to order.</h2></div><div className="note-items"><div><strong>01</strong><span>Browse the catalog and compare the products available now.</span></div><div><strong>02</strong><span>Open a product to review the information provided by the store.</span></div><div><strong>03</strong><span>Add what you need to the cart and continue to checkout.</span></div></div></section>

      <footer className="site-footer"><div className="container footer-grid"><div><img className="footer-logo" src="/lingo-logo.svg" alt="Lingo" /><p className="muted">The Lingo Store customer storefront.</p></div><div><h3>Shop</h3><Link href="/products">Products</Link><Link href="/cart">Cart</Link></div><div><h3>Company</h3><Link href="/about">About</Link><Link href="/contact">Contact</Link></div><div><h3>Account</h3><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></div></div></footer>
    </main>
  );
}
