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
  const featuredProducts = [...products]
    .sort((a, b) => categoryPriority(a) - categoryPriority(b))
    .slice(0, 4);
  const categories = [...new Map(products.flatMap((product) => product.category ? [[product.category.id, product.category]] : [])).values()].slice(0, 3);

  return (
    <div className="hero-stage" aria-label="Featured Lingo Store products">
      <div className="hero-available-now">
        <span className="hero-available-icon" aria-hidden="true">▣</span>
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

      {featuredProducts.length > 0 ? (
        <div className="hero-product-stack">
          {featuredProducts.map((product, index) => (
            <Link
              key={product.id}
              className={`hero-featured-product hero-featured-product-${index + 1}`}
              href={`/products/${encodeURIComponent(product.sku)}`}
              aria-label={`View ${product.name}`}
            >
              <div className="hero-featured-image">
                {product.imageUrl ? <CleanProductImage src={product.imageUrl} alt="" /> : <span>{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
              </div>
              <div className="hero-featured-info">
                <span>PRODUCT</span>
                <strong>{product.name}</strong>
                <b>{formatMinor(product.priceMinor)}</b>
              </div>
            </Link>
          ))}
        </div>
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
        <style>{`
          .hero-retail {
            background:
              radial-gradient(ellipse 62% 72% at 70% 48%, rgba(235,239,255,.9) 0%, rgba(247,248,255,.72) 38%, rgba(255,255,255,0) 72%),
              radial-gradient(ellipse 46% 70% at 30% 50%, rgba(239,243,255,.72) 0%, rgba(255,255,255,0) 70%),
              #fff !important;
          }
          .hero-stage {
            height: 600px !important;
            min-height: 600px !important;
          }
          .hero-stage::before {
            width: 610px !important;
            height: 610px !important;
            left: 55% !important;
            top: 50% !important;
            background:
              radial-gradient(circle at 52% 40%, rgba(224,228,255,.9) 0 31%, rgba(238,240,255,.65) 32% 48%, transparent 49%),
              radial-gradient(circle at 70% 38%, rgba(255,167,78,.95) 0 9%, transparent 9.5%),
              radial-gradient(circle at 50% 67%, rgba(232,236,255,.55), transparent 58%) !important;
            filter: none !important;
          }
          .hero-stage::after {
            width: 620px !important;
            height: 440px !important;
            left: 55% !important;
            top: 53% !important;
            border: 1px solid rgba(35,53,173,.09) !important;
            box-shadow: inset 0 0 0 38px rgba(238,241,255,.18) !important;
          }
          .hero-stage-orbit-main {
            width: 470px !important;
            height: 470px !important;
            left: 55% !important;
            top: 52% !important;
            border: 1px solid rgba(35,53,173,.10) !important;
          }
          .hero-stage-orbit-soft {
            width: 330px !important;
            height: 330px !important;
            left: 55% !important;
            top: 52% !important;
            border: 1px dashed rgba(35,53,173,.12) !important;
          }
          .hero-stage-grid {
            right: -1% !important;
            top: 44% !important;
            width: 100px !important;
            height: 100px !important;
            background-size: 15px 15px !important;
            opacity: .5 !important;
          }
          .hero-stage-dot-one {
            right: 8% !important;
            top: 66% !important;
            width: 17px !important;
            height: 17px !important;
          }
          .hero-stage-dot-two {
            left: 6% !important;
            bottom: 10% !important;
          }
          .hero-product-stack { inset: 0 !important; }
          .hero-featured-product {
            box-shadow: 0 24px 50px rgba(16,24,40,.14) !important;
          }
          .hero-featured-product-1 {
            left: 31% !important;
            top: 17% !important;
            width: 300px !important;
            height: 455px !important;
            grid-template-rows: 340px auto !important;
            transform: rotate(3deg) !important;
            z-index: 12 !important;
          }
          .hero-featured-product-2 {
            left: 2% !important;
            top: 25% !important;
            width: 220px !important;
            height: 330px !important;
            grid-template-rows: 245px auto !important;
            transform: rotate(-10deg) !important;
            z-index: 10 !important;
          }
          .hero-featured-product-3 {
            left: 68% !important;
            top: 20% !important;
            width: 215px !important;
            height: 315px !important;
            grid-template-rows: 235px auto !important;
            transform: rotate(8deg) !important;
            z-index: 9 !important;
          }
          .hero-featured-product-4 {
            left: 64% !important;
            top: 57% !important;
            width: 205px !important;
            height: 300px !important;
            grid-template-rows: 220px auto !important;
            transform: rotate(10deg) !important;
            z-index: 8 !important;
          }
          .hero-featured-product-1:hover { transform: translateY(-8px) rotate(3deg) scale(1.015) !important; }
          .hero-featured-product-2:hover { transform: translateY(-8px) rotate(-10deg) scale(1.02) !important; }
          .hero-featured-product-3:hover { transform: translateY(-8px) rotate(8deg) scale(1.02) !important; }
          .hero-featured-product-4:hover { transform: translateY(-8px) rotate(10deg) scale(1.02) !important; }
          .hero-featured-image { padding: 18px !important; }
          .hero-featured-product-1 .hero-featured-image { padding: 20px !important; }
          .hero-featured-product-4 .hero-featured-image { padding: 14px !important; }
          .hero-available-now {
            top: 2px !important;
            right: 2% !important;
            min-width: 255px !important;
            padding: 12px 13px 12px 15px !important;
            gap: 11px !important;
            border: 0 !important;
            background: rgba(255,255,255,.9) !important;
            box-shadow: 0 14px 34px rgba(16,24,40,.08) !important;
          }
          .hero-available-icon {
            width: 34px !important;
            height: 34px !important;
            display: grid !important;
            place-items: center !important;
            flex: 0 0 34px !important;
            border-radius: 10px !important;
            background: #eef1ff !important;
            color: #2335ad !important;
            font-size: 16px !important;
            font-weight: 900 !important;
          }
          .hero-available-now strong { font-size: 13px !important; }
          .hero-available-now small { font-size: 10px !important; }
          .hero-available-now a {
            width: 38px !important;
            height: 38px !important;
            flex-basis: 38px !important;
            margin-left: auto !important;
            background: #eef1ff !important;
            color: #2335ad !important;
            font-size: 18px !important;
          }
          .hero-showcase-footer { bottom: 0 !important; }
          @media (max-width: 1050px) {
            .hero-stage { height: 570px !important; min-height: 570px !important; }
            .hero-featured-product-1 { left: 30% !important; }
            .hero-featured-product-3 { left: 66% !important; }
            .hero-featured-product-4 { left: 61% !important; }
          }
          @media (max-width: 700px) {
            .hero-stage { height: 500px !important; min-height: 500px !important; }
            .hero-featured-product-1 { left: 24% !important; top: 18% !important; width: 225px !important; height: 365px !important; grid-template-rows: 278px auto !important; }
            .hero-featured-product-2 { left: 0 !important; top: 31% !important; width: 165px !important; height: 285px !important; grid-template-rows: 210px auto !important; }
            .hero-featured-product-3 { left: 61% !important; top: 29% !important; width: 165px !important; height: 285px !important; grid-template-rows: 210px auto !important; }
            .hero-featured-product-4 { left: 56% !important; top: 61% !important; width: 155px !important; height: 250px !important; grid-template-rows: 180px auto !important; }
            .hero-available-now { right: 0 !important; min-width: 210px !important; }
          }
          @media (max-width: 480px) {
            .hero-stage { height: 430px !important; min-height: 430px !important; }
            .hero-featured-product-1 { left: 21% !important; width: 190px !important; height: 305px !important; grid-template-rows: 230px auto !important; }
            .hero-featured-product-2 { width: 135px !important; height: 230px !important; grid-template-rows: 165px auto !important; }
            .hero-featured-product-3 { left: 59% !important; width: 135px !important; height: 230px !important; grid-template-rows: 165px auto !important; }
            .hero-featured-product-4 { left: 55% !important; width: 125px !important; height: 205px !important; grid-template-rows: 148px auto !important; }
            .hero-available-now { min-width: 190px !important; }
            .hero-available-icon { display: none !important; }
          }
        `}</style>
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
