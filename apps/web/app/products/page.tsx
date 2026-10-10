import Link from "next/link";
import ProductGrid from "./ProductGrid";
import { getCatalog } from "../catalog";
export const dynamic = "force-dynamic";
export default async function Products() {
  const catalog = await getCatalog();
  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/">
            Lingo Store
          </Link>
          <nav className="nav">
            <Link href="/products">Products</Link>
            <Link href="/services">Services</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </header>
      <section className="container section">
        <div className="breadcrumbs">
          <Link href="/">Home</Link> / Products
        </div>
        <div className="section-head">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>All products</h1>
            <p className="muted">Browse the current Lingo Store catalog.</p>
          </div>
        </div>
        {catalog.error ? (
          <section className="card" role="alert">
            <h2>Catalog unavailable</h2>
            <p className="muted">Products could not be loaded. Refresh this page to try again.</p>
          </section>
        ) : (
          <ProductGrid products={catalog.products} />
        )}
      </section>
      <footer className="site-footer">
        <div className="container">
          <p className="muted">Lingo Store · Secure customer storefront</p>
        </div>
      </footer>
    </main>
  );
}
