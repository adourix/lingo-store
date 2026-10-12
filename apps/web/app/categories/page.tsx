import Link from "next/link";
import { access } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../catalog";
import CleanProductImage from "../CleanProductImage";
import Footer from "../Footer";

export const dynamic = "force-dynamic";

const CATEGORY_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

function fallbackCategoryImage(name: string): string {
  const value = name.toLocaleLowerCase();
  if (/(mobile|phone|smartphone|موبايل|هاتف)/.test(value)) return "/category-images/mobiles.svg";
  if (/(laptop|notebook|computer|حاسب|لاب)/.test(value)) return "/category-images/laptops.svg";
  if (/(tablet|ipad|تابلت)/.test(value)) return "/category-images/tablets.svg";
  if (/(audio|headphone|earbud|speaker|صوت|سماعات)/.test(value)) return "/category-images/audio.svg";
  if (/(accessor|charger|cable|شاحن|اكسسوار)/.test(value)) return "/category-images/accessories.svg";
  if (/(wearable|watch|smartwatch|ساعة)/.test(value)) return "/category-images/wearables.svg";
  return "/category-images/general.svg";
}

async function categoryImage(id: string, name: string): Promise<string> {
  const root = process.env.CATEGORY_IMAGE_DIR || path.resolve(process.cwd(), "../../.data/category-images");
  for (const extension of CATEGORY_IMAGE_EXTENSIONS) {
    const filename = `${id}.${extension}`;
    try {
      await access(path.join(root, filename));
      return `/uploads/categories/${filename}`;
    } catch {
      // Try the next supported extension, then use the built-in category artwork.
    }
  }
  return fallbackCategoryImage(name);
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

  const categoryCards = await Promise.all(
    categories.map(async (category) => ({
      category,
      imageUrl: await categoryImage(category.id, category.name),
      count: catalog.products.filter((product) => product.category?.id === category.id).length,
    })),
  );

  const heroProducts = catalog.products.filter((product) => product.imageUrl).slice(0, 4);

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

      <section className="container section categories-section">
        <div className="breadcrumbs"><Link href="/">Home</Link> / Categories</div>

        <div className="categories-hero">
          <div className="categories-hero-copy">
            <p className="eyebrow">BROWSE</p>
            <h1>Shop by category.</h1>
            <p>Choose a category to explore our products. Each category opens the same shopping experience with that filter already selected.</p>
          </div>
          <div className="categories-hero-visual" aria-hidden="true">
            <span className="category-orbit category-orbit-one" />
            <span className="category-orbit category-orbit-two" />
            {heroProducts.length > 0 ? heroProducts.map((product, index) => (
              <div className={`category-hero-product category-hero-product-${index + 1}`} key={product.id}>
                <CleanProductImage src={product.imageUrl!} alt="" />
              </div>
            )) : <div className="category-hero-empty">Lingo</div>}
          </div>
        </div>

        {catalog.error ? (
          <section className="state-panel" role="alert">
            <h2>Categories unavailable</h2>
            <p>We could not load the live catalog right now. Refresh to try again.</p>
          </section>
        ) : categoryCards.length === 0 ? (
          <div className="category-directory-empty">No published product categories are available yet.</div>
        ) : (
          <div className="category-directory">
            {categoryCards.map(({ category, imageUrl, count }) => (
              <Link
                className="category-directory-card"
                href={`/products?category=${encodeURIComponent(category.id)}`}
                key={category.id}
              >
                <div className="category-image-wrap">
                  <img src={imageUrl} alt="" aria-hidden="true" />
                </div>
                <div className="category-card-copy">
                  <h2>{category.name}</h2>
                  <p>{category.description || "Browse products in this category."}</p>
                  <strong>{count} {count === 1 ? "product" : "products"}</strong>
                </div>
                <span className="category-card-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}

        {!catalog.error && categoryCards.length > 0 && (
          <>
            <Link className="categories-all-products" href="/products">
              <span className="categories-all-icon" aria-hidden="true">♧</span>
              <span>
                <small>CAN'T FIND WHAT YOU'RE LOOKING FOR?</small>
                <strong>View all products</strong>
                <em>Browse our complete catalog and find exactly what you need.</em>
              </span>
              <b>View all products <span aria-hidden="true">→</span></b>
            </Link>

            <div className="categories-benefits" aria-label="Lingo Store benefits">
              <div><span>▣</span><strong>Fast Delivery</strong><small>Across Egypt</small></div>
              <div><span>◇</span><strong>Original Products</strong><small>100% authentic</small></div>
              <div><span>♧</span><strong>Dedicated Support</strong><small>We're here to help</small></div>
              <div><span>▤</span><strong>Secure Payments</strong><small>Multiple payment options</small></div>
            </div>
          </>
        )}
      </section>

      <Footer />
    </main>
  );
}
