import Link from "next/link";
import ProductGrid from "./ProductGrid";
import { getCatalog } from "../catalog";
import Footer from "../Footer";
export const dynamic = "force-dynamic";

export default async function Products({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const catalog = await getCatalog();
  const params = await searchParams;
  const initialCategory = params.category || "";

  return <main className="site-shell"><div className="utility-bar"><div className="container utility-inner"><span>Lingo Store</span><div><Link href="/contact">Need help?</Link><span aria-hidden="true">·</span><Link href="/login">Sign in</Link></div></div></div><header className="site-header"><div className="site-header-inner"><Link className="brand" href="/" aria-label="Lingo Store home"><img src="/lingo-logo.svg" alt="Lingo" /></Link><nav className="nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/products">Shop</Link><Link href="/categories">Categories</Link><Link href="/about">About</Link><Link href="/contact">Support</Link></nav><div className="header-actions"><Link className="header-action" href="/account">Account</Link><Link className="header-cart" href="/cart">Cart</Link></div></div></header><section className="container section"><div className="breadcrumbs"><Link href="/">Home</Link> / Products</div><div className="section-head"><div><p className="eyebrow">CATALOG</p><h1>{initialCategory ? "Category products" : "All products"}</h1><p className="muted">Search by product, SKU or brand, then filter by category.</p></div><Link className="button secondary" href="/cart">Open cart</Link></div>{catalog.error ? <section className="state-panel" role="alert"><h2>Catalog unavailable</h2><p>Products could not be loaded. Refresh this page to try again.</p></section> : <ProductGrid products={catalog.products} initialCategory={initialCategory} />}</section><Footer /></main>;
}
