import Link from "next/link";
import CleanProductImage from "../CleanProductImage";
import ProductGrid from "./ProductGrid";
import { getCatalog, type CatalogProduct } from "../catalog";
import Footer from "../Footer";
export const dynamic = "force-dynamic";

function categoryPriority(product: CatalogProduct): number {
  const name = product.category?.name?.toLowerCase() || "";
  if (name.includes("mobile") || name.includes("phone") || name.includes("smartphone")) return 0;
  if (name.includes("accessor") || name.includes("audio") || name.includes("headphone")) return 1;
  return 2;
}

function ShopHero({ products }: { products: CatalogProduct[] }) {
  const featured = [...products].sort((a, b) => categoryPriority(a) - categoryPriority(b)).slice(0, 3);
  return (
    <section className="shop-hero" aria-label="Lingo Store shop introduction">
      <div className="shop-hero-copy">
        <p className="eyebrow">CATALOG</p>
        <h1>All products</h1>
        <p>Discover our complete collection. Search by product, SKU or brand, then filter by category to find exactly what you need.</p>
        <div className="shop-benefits">
          <span className="shop-benefit"><b className="shop-benefit-icon" aria-hidden="true">◇</b><strong>Original Products</strong><small>100% authentic</small></span>
          <span className="shop-benefit"><b className="shop-benefit-icon" aria-hidden="true">▣</b><strong>Fast Delivery</strong><small>Across Egypt</small></span>
          <span className="shop-benefit"><b className="shop-benefit-icon" aria-hidden="true">▤</b><strong>Secure Payments</strong><small>Multiple payment options</small></span>
        </div>
      </div>
      <div className="shop-hero-visual" aria-hidden="true">
        <span className="shop-hero-orb one" />
        <span className="shop-hero-orb two" />
        {featured[1]?.imageUrl && <div className="shop-hero-product left"><CleanProductImage src={featured[1].imageUrl} alt="" /></div>}
        {featured[0]?.imageUrl && <div className="shop-hero-product main"><CleanProductImage src={featured[0].imageUrl} alt="" /></div>}
        {featured[2]?.imageUrl && <div className="shop-hero-product right"><CleanProductImage src={featured[2].imageUrl} alt="" /></div>}
        {!featured.some((product) => product.imageUrl) && <div className="shop-hero-empty">Published products will appear here.</div>}
      </div>
    </section>
  );
}

export default async function Products({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const catalog = await getCatalog(true);
  const params = await searchParams;
  const initialCategory = params.category || "";

  return (
    <main className="site-shell shop-page">
      <div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/contact">Need help?</Link><span aria-hidden="true">·</span><Link href="/login">Sign in</Link></div></div></div>
      <header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/products">Search products...</Link><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header>

      <div className="shop-content">
        <div className="shop-breadcrumbs"><Link href="/">Home</Link> <span aria-hidden="true">/</span> Products</div>
        <ShopHero products={catalog.products.filter((product) => product.stock === null || product.stock > 0)} />
        {catalog.error ? <section className="state-panel" role="alert"><h2>Catalog unavailable</h2><p>Products could not be loaded. Refresh this page to try again.</p></section> : <ProductGrid products={catalog.products} initialCategory={initialCategory} />}
      </div>
      <Footer />
    </main>
  );
}
