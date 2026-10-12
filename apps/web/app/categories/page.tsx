import Link from "next/link";
import { getCatalog } from "../catalog";
import Footer from "../Footer";

export const dynamic = "force-dynamic";

function categoryImage(name: string): string {
  const value = name.toLocaleLowerCase();
  if (/(mobile|phone|smartphone|موبايل|هاتف)/.test(value)) return "/category-images/mobiles.svg";
  if (/(laptop|notebook|computer|حاسب|لاب)/.test(value)) return "/category-images/laptops.svg";
  if (/(tablet|ipad|تابلت)/.test(value)) return "/category-images/tablets.svg";
  if (/(audio|headphone|earbud|speaker|صوت|سماعات)/.test(value)) return "/category-images/audio.svg";
  if (/(accessor|charger|cable|شاحن|اكسسوار)/.test(value)) return "/category-images/accessories.svg";
  if (/(wearable|watch|smartwatch|ساعة)/.test(value)) return "/category-images/wearables.svg";
  return "/category-images/general.svg";
}

export default async function Categories() {
  const catalog = await getCatalog();
  const categories = [...
    new Map(
      catalog.products.flatMap((product) =>
        product.category ? [[product.category.id, product.category]] : [],
      ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="site-shell categories-page">
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
            <Link href="/categories" aria-current="page">Categories</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Support</Link>
          </nav>
          <div className="header-actions">
            <Link className="header-action" href="/products">Search</Link>
            <Link className="header-action" href="/account">Account</Link>
            <Link className="header-cart" href="/cart">Cart</Link>
          </div>
        </div>
      </header>

      <section className="container section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / Categories</div>
        <div className="categories-hero">
          <div>
            <p className="eyebrow">BROWSE</p>
            <h1>Shop by category.</h1>
            <p>Choose a category to explore the live Lingo catalog. Each category opens the same product shopping experience with that filter already selected.</p>
          </div>
          <Link className="button secondary" href="/products">View all products</Link>
        </div>

        {catalog.error ? (
          <section className="state-panel" role="alert">
            <h2>Categories unavailable</h2>
            <p>We could not load the live catalog right now. Refresh to try again.</p>
          </section>
        ) : categories.length === 0 ? (
          <div className="category-directory-empty">
            No published product categories are available yet.
          </div>
        ) : (
          <div className="category-directory">
            {categories.map((category) => {
              const count = catalog.products.filter((product) => product.category?.id === category.id).length;
              return (
                <Link
                  className="category-directory-card"
                  href={`/products?category=${encodeURIComponent(category.id)}`}
                  key={category.id}
                >
                  <div className="category-card-main">
                    <div className="category-image-wrap">
                      <img src={categoryImage(category.name)} alt="" aria-hidden="true" />
                    </div>
                    <div className="category-card-copy">
                      <div className="category-card-heading">
                        <span className="category-icon" aria-hidden="true">{category.name.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <h2>{category.name}</h2>
                          <p>{category.description || "Browse products in this category."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="category-card-footer">
                    <span>{count} {count === 1 ? "product" : "products"}</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
