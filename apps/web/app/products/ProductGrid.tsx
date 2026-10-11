"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: number | string;
  imageUrl: string | null;
  brand: string | null;
  category: { id: string; name: string; description: string | null } | null;
};

function minorMoney(value: number | string): string {
  const minor = BigInt(value);
  const major = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  return `${new Intl.NumberFormat("en").format(major)}.${fraction} EGP`;
}

export default function ProductGrid({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("featured");
  const categories = useMemo(
    () =>
      [...new Map(products.flatMap((p) => (p.category ? [[p.category.id, p.category]] : []))).values()].sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    [products],
  );
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const matches = products.filter((product) => {
      const text = [product.name, product.sku, product.description ?? "", product.brand ?? ""];
      return (
        (!search || text.some((value) => value.toLocaleLowerCase().includes(search))) &&
        (!category || product.category?.id === category)
      );
    });
    if (sort === "price-low")
      matches.sort((a, b) => Number(BigInt(a.priceMinor) - BigInt(b.priceMinor)));
    if (sort === "price-high")
      matches.sort((a, b) => Number(BigInt(b.priceMinor) - BigInt(a.priceMinor)));
    return matches;
  }, [products, query, category, sort]);

  return (
    <>
      <div className="filter-bar">
        <input
          aria-label="Search products"
          placeholder="Search by name, SKU or brand"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="featured">Featured</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <section className="card" aria-live="polite">
          <h2>{query || category ? "No matching products" : "No products yet"}</h2>
          <p className="muted">
            {query || category ? "Try another search or category." : "Published products will appear here."}
          </p>
        </section>
      ) : (
        <div className="grid" aria-live="polite">
          {filtered.map((product) => (
            <Link className="card product-card" href={`/products/${encodeURIComponent(product.sku)}`} key={product.id}>
              <div className="product-image" aria-hidden="true">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span>{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>
                )}
              </div>
              <div className="product-card-body">
                <div className="product-meta-row">
                  <span className="eyebrow">{product.category?.name || "Product"}</span>
                  {product.brand && <span className="muted">{product.brand}</span>}
                </div>
                <h3>{product.name}</h3>
                {product.description && <p>{product.description}</p>}
                <div className="product-card-footer">
                  <p className="price">{minorMoney(product.priceMinor)}</p>
                  <span className="button primary">View product</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
