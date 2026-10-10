import Link from "next/link";
import AddToCartButton from "../AddToCartButton";
import { getCatalog } from "../../catalog";
export const dynamic = "force-dynamic";
function formatMinor(value: string | number): string {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n)
    .toString()
    .padStart(2, "0")} EGP`;
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const p = catalog.products.find((x) => x.sku === decodeURIComponent(slug));
  if (catalog.error || !p)
    return (
      <main className="container section">
        <p>{catalog.error ? "Product details are temporarily unavailable." : "Product not found."}</p>
        <Link href="/products">Back to products</Link>
      </main>
    );
  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/">
            Lingo Store
          </Link>
          <Link href="/products">← Products</Link>
        </div>
      </header>
      <section className="container section">
        <p className="muted">{p.sku}</p>
        <h1>{p.name}</h1>
        <p style={{ maxWidth: 680, fontSize: 18 }}>{p.description || "Available in store."}</p>
        <p className="price">{formatMinor(p.priceMinor)}</p>
        <AddToCartButton productId={p.id} />
      </section>
    </main>
  );
}
