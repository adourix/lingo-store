import Link from "next/link";
export default function Services() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/">
            Lingo Store
          </Link>
          <nav className="nav">
            <Link href="/products">Products</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </header>
      <section className="container section">
        <div className="breadcrumbs">
          <Link href="/">Home</Link> / Services
        </div>
        <p className="eyebrow">Services</p>
        <h1>Support that follows the store workflow.</h1>
        <p style={{ maxWidth: 720, fontSize: 19, lineHeight: 1.7, color: "#667085" }}>
          From product discovery to customer support, Lingo Store keeps the public experience
          focused and the operational complexity behind a protected staff application.
        </p>
        <div className="grid" style={{ marginTop: 34 }}>
          <article className="card">
            <p className="eyebrow">01</p>
            <h2>Customer accounts</h2>
            <p className="muted">
              Maintain your profile, keep contact information current, and access customer-owned
              order history.
            </p>
            <Link href="/register" className="button secondary">
              Create account
            </Link>
          </article>
          <article className="card">
            <p className="eyebrow">02</p>
            <h2>Store support</h2>
            <p className="muted">
              Questions about availability, products, or orders can be sent directly through the
              contact form.
            </p>
            <Link href="/contact" className="button secondary">
              Contact the store
            </Link>
          </article>
          <article className="card">
            <p className="eyebrow">03</p>
            <h2>Business operations</h2>
            <p className="muted">
              Staff workflows cover inventory, sales, purchasing, customers, suppliers, cash
              sessions, reports, and audit history.
            </p>
            <Link href="/about" className="button secondary">
              Learn more
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
