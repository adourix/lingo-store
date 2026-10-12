import Link from "next/link";

export default function Header() {
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>Lingo Store</span>
          <div>
            <Link href="/contact">Need help?</Link>
            <span aria-hidden="true">·</span>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Lingo Store home">
            <img src="/lingo-logo.svg" alt="Lingo" />
          </Link>
          <nav className="nav" aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/products">Shop</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Support</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-action" href="/products" aria-label="Browse products">Search</Link>
            <Link className="header-action" href="/account">Account</Link>
            <Link className="header-cart" href="/cart">Cart</Link>
          </div>
        </div>
      </header>
    </>
  );
}
